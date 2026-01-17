
"""
WebRTC Clipboard Sync - Multi-Device Mesh Network

Installation:
pip install aiortc aiohttp pyperclip

Usage:
Terminal 1: python main.py --host
Terminal 2: python main.py --join

Clipboard is automatically synced across all connected devices!
"""

import asyncio
import json
import random
import argparse
import aiohttp
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
import pyperclip
import hashlib


# ============= SIGNALING SERVER (runs in host mode) =============
class SignalingServer:
    def __init__(self):
        self.rooms = {}  # {room_code: {peer_id: websocket}}
        self.app = web.Application()
        self.app.router.add_get('/ws', self.websocket_handler)
        self.runner = None
    
    async def start(self):
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, '0.0.0.0', 8080)
        await site.start()
        
        # Get local IP address
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
        except:
            local_ip = '127.0.0.1'
        finally:
            s.close()
        
        print(f"[Server started on 0.0.0.0:8080]")
        print(f"[Local IP: {local_ip}:8080]")
    
    async def stop(self):
        if self.runner:
            await self.runner.cleanup()
    
    async def websocket_handler(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        room_code = None
        peer_id = None
        
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                data = json.loads(msg.data)
                
                if data['type'] == 'join':
                    room_code = data['code']
                    peer_id = data.get('peerId', str(random.randint(100000, 999999)))
                    
                    if room_code not in self.rooms:
                        self.rooms[room_code] = {}
                    
                    # Get list of existing peers
                    existing_peers = list(self.rooms[room_code].keys())
                    
                    # Add this peer to room
                    self.rooms[room_code][peer_id] = ws
                    
                    # Send joined confirmation with peer list
                    await ws.send_str(json.dumps({
                        'type': 'joined',
                        'code': room_code,
                        'myId': peer_id,
                        'peers': existing_peers,  # List of peer IDs already in room
                        'peerCount': len(self.rooms[room_code])
                    }))
                    
                    print(f"[Peer {peer_id} joined room {room_code}. Total peers: {len(self.rooms[room_code])}")
                    
                    # Notify all existing peers about new peer
                    for existing_peer_id, existing_ws in self.rooms[room_code].items():
                        if existing_peer_id != peer_id:
                            await existing_ws.send_str(json.dumps({
                                'type': 'peer_joined',
                                'peerId': peer_id
                            }))
                
                elif data['type'] in ['offer', 'answer', 'ice']:
                    # Route message to specific peer
                    target_peer_id = data.get('targetPeer')
                    if room_code and room_code in self.rooms and target_peer_id in self.rooms[room_code]:
                        target_ws = self.rooms[room_code][target_peer_id]
                        # Add fromPeer to the message
                        data['fromPeer'] = peer_id
                        await target_ws.send_str(json.dumps(data))
        
        # Handle disconnection
        if room_code and room_code in self.rooms and peer_id:
            if peer_id in self.rooms[room_code]:
                del self.rooms[room_code][peer_id]
                print(f"[Peer {peer_id} left room {room_code}. Remaining peers: {len(self.rooms[room_code])}")
                
                # Notify remaining peers
                for remaining_peer_id, remaining_ws in self.rooms[room_code].items():
                    await remaining_ws.send_str(json.dumps({
                        'type': 'peer_left',
                        'peerId': peer_id
                    }))
                
                # Clean up empty room
                if not self.rooms[room_code]:
                    del self.rooms[room_code]
        
        return ws



# ============= WEBRTC CHAT CLIENT (Multi-Peer Support) =============
class WebRTCChat:
    def __init__(self):
        self.peer_connections = {}  # {peer_id: {'pc': RTCPeerConnection, 'channel': DataChannel}}
        self.ws = None
        self.my_peer_id = None
        self.last_clipboard_hash = None
        self.clipboard_monitor_task = None
        
    def get_clipboard_hash(self, text):
        """Generate MD5 hash of clipboard content"""
        return hashlib.md5(text.encode('utf-8')).hexdigest()
    
    async def start_clipboard_monitor(self):
        """Monitor clipboard for changes and broadcast to peers"""
        print("[Clipboard] Monitoring started...")
        while True:
            try:
                current = pyperclip.paste()
                if current:
                    current_hash = self.get_clipboard_hash(current)
                    
                    if current_hash != self.last_clipboard_hash:
                        self.last_clipboard_hash = current_hash
                        preview = current[:50] + "..." if len(current) > 50 else current
                        print(f"\n[Clipboard] Syncing: {preview}")
                        self.broadcast_clipboard(current, current_hash)
                
                await asyncio.sleep(0.5)  # Check every 500ms
            except Exception as e:
                print(f"\n[Clipboard Error]: {e}")
                await asyncio.sleep(1)
    
    def broadcast_clipboard(self, content, content_hash):
        """Send clipboard content to all peers"""
        message = json.dumps({
            'type': 'clipboard',
            'content': content,
            'hash': content_hash
        })
        sent_count = self.broadcast_message(message)
        if sent_count:
            print(f"[Clipboard] Sent to {sent_count} peer(s)")
    
    def on_message(self, message, from_peer):
        """Handle received messages (clipboard data)"""
        try:
            data = json.loads(message)
            if data['type'] == 'clipboard':
                content = data['content']
                content_hash = data['hash']
                
                if content_hash != self.last_clipboard_hash:
                    self.last_clipboard_hash = content_hash
                    pyperclip.copy(content)
                    preview = content[:50] + "..." if len(content) > 50 else content
                    print(f"\n[Clipboard] Received from {from_peer[:8]}...: {preview}")
        except json.JSONDecodeError:
            # Not JSON, treat as regular chat message
            print(f"\n[Peer {from_peer[:8]}...]: {message}")
            print(">> ", end='', flush=True)
        except Exception as e:
            print(f"\n[Clipboard Error]: {e}")
    
    async def connect_signaling(self, room_code, server_url='http://localhost:8080'):
        session = aiohttp.ClientSession()
        self.ws = await session.ws_connect(f'{server_url}/ws')
        
        # Generate peer ID in same format as mobile app
        import time
        timestamp = int(time.time() * 1000)
        random_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))
        self.my_peer_id = f"peer-{timestamp}-{random_str}"
        await self.ws.send_json({'type': 'join', 'code': room_code, 'peerId': self.my_peer_id})
        asyncio.create_task(self.handle_signaling())
        
        return session
    
    async def handle_signaling(self):
        async for msg in self.ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                
                if data['type'] == 'joined':
                    my_id = data.get('myId')
                    existing_peers = data.get('peers', [])
                    peer_count = data.get('peerCount', 1)
                    
                    print(f"[Joined room. My ID: {my_id[:8]}..., Peers: {len(existing_peers)}]")
                    
                    if len(existing_peers) == 0:
                        print("[Waiting for peers...]")
                    else:
                        print(f"[Found {len(existing_peers)} peer(s)!]")
                        # Create connections to existing peers
                        for peer_id in existing_peers:
                            should_initiate = self.my_peer_id < peer_id
                            if should_initiate:
                                await self.create_peer_connection(peer_id, is_initiator=True)
                
                elif data['type'] == 'peer_joined':
                    peer_id = data.get('peerId')
                    print(f"\n[Peer {peer_id[:8]}... joined]")
                    print(">> ", end='', flush=True)
                    
                    # Use peer ID comparison to determine who initiates
                    should_initiate = self.my_peer_id < peer_id
                    if should_initiate:
                        print(f"[Creating connection to {peer_id[:8]}...]")
                        await self.create_peer_connection(peer_id, is_initiator=True)
                    else:
                        print(f"[Waiting for connection from {peer_id[:8]}...]")
                
                elif data['type'] == 'offer':
                    from_peer = data.get('fromPeer')
                    if from_peer not in self.peer_connections:
                        await self.create_peer_connection(from_peer, is_initiator=False)
                    await self.handle_offer(from_peer, data['sdp'])
                
                elif data['type'] == 'answer':
                    from_peer = data.get('fromPeer')
                    await self.handle_answer(from_peer, data['sdp'])
                
                elif data['type'] == 'ice':
                    from_peer = data.get('fromPeer')
                    if from_peer in self.peer_connections and data.get('candidate'):
                        cand_data = data['candidate']
                        candidate_str = cand_data.get('candidate')
                        sdp_mid = cand_data.get('sdpMid')
                        sdp_mline_index = cand_data.get('sdpMLineIndex')
                        
                        # Parse the candidate string to create RTCIceCandidate
                        # We need to handle the "candidate:" prefix if present
                        if candidate_str:
                            parts = candidate_str.split()
                            # Basic parsing relying on standard candidate format
                            # candidate:foundation component protocol priority ip port typ type ...
                            if len(parts) >= 8:
                                from aiortc.sdp import candidate_from_sdp
                                candidate = candidate_from_sdp(candidate_str)
                                candidate.sdpMid = sdp_mid
                                candidate.sdpMLineIndex = sdp_mline_index
                                
                                pc = self.peer_connections[from_peer]['pc']
                                await pc.addIceCandidate(candidate)
                
                elif data['type'] == 'peer_left':
                    peer_id = data.get('peerId')
                    print(f"\n[Peer {peer_id[:8]}... left]")
                    print(">> ", end='', flush=True)
                    if peer_id in self.peer_connections:
                        await self.remove_peer(peer_id)
    
    async def create_peer_connection(self, peer_id, is_initiator):
        if peer_id in self.peer_connections:
            return
        
        print(f"[Creating peer connection to {peer_id[:8]}... (initiator: {is_initiator})]")
        
        pc = RTCPeerConnection()
        peer_info = {'pc': pc, 'channel': None}
        self.peer_connections[peer_id] = peer_info
        
        # Handle ICE candidates
        @pc.on("icecandidate")
        async def on_ice(event):
            if event.candidate:
                await self.ws.send_json({
                    'type': 'ice',
                    'targetPeer': peer_id,
                    'candidate': {
                        'candidate': event.candidate.candidate,
                        'sdpMid': event.candidate.sdpMid,
                        'sdpMLineIndex': event.candidate.sdpMLineIndex
                    }
                })
        
        if is_initiator:
            # Create data channel
            channel = pc.createDataChannel("chat")
            peer_info['channel'] = channel
            self.setup_channel(peer_id, channel)
            
            # Create and send offer
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            await self.ws.send_json({
                'type': 'offer',
                'targetPeer': peer_id,
                'sdp': {'type': pc.localDescription.type, 'sdp': pc.localDescription.sdp}
            })
        else:
            # Wait for data channel
            @pc.on("datachannel")
            def on_datachannel(channel):
                peer_info['channel'] = channel
                self.setup_channel(peer_id, channel)
    
    async def handle_offer(self, from_peer, sdp):
        pc = self.peer_connections[from_peer]['pc']
        
        await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp['sdp'], type=sdp['type']))
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        await self.ws.send_json({
            'type': 'answer',
            'targetPeer': from_peer,
            'sdp': {'type': pc.localDescription.type, 'sdp': pc.localDescription.sdp}
        })
    
    async def handle_answer(self, from_peer, sdp):
        pc = self.peer_connections[from_peer]['pc']
        await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp['sdp'], type=sdp['type']))
    
    def setup_channel(self, peer_id, channel):
        @channel.on("open")
        def on_open():
            print(f"\n✓ Connected to peer {peer_id[:8]}...!")
            print(f"[Total connections: {self.get_connected_count()}]")
            print(">> ", end='', flush=True)
        
        @channel.on("message")
        def on_message(message):
            self.on_message(message, peer_id)
    
    def broadcast_message(self, message):
        sent_count = 0
        for peer_id, peer_info in self.peer_connections.items():
            channel = peer_info['channel']
            if channel and channel.readyState == "open":
                channel.send(message)
                sent_count += 1
        return sent_count > 0
    
    def get_connected_count(self):
        count = 0
        for peer_info in self.peer_connections.values():
            if peer_info['channel'] and peer_info['channel'].readyState == "open":
                count += 1
        return count
    
    async def remove_peer(self, peer_id):
        if peer_id in self.peer_connections:
            peer_info = self.peer_connections[peer_id]
            if peer_info['channel']:
                peer_info['channel'].close()
            await peer_info['pc'].close()
            del self.peer_connections[peer_id]
    
    async def close(self):
        if self.ws:
            await self.ws.close()
        for peer_info in self.peer_connections.values():
            if peer_info['channel']:
                peer_info['channel'].close()
            await peer_info['pc'].close()
        self.peer_connections.clear()



# ============= MAIN APPLICATION =============
async def run_host():
    print("=== HOST MODE ===\n")
    
    # Start signaling server
    server = SignalingServer()
    await server.start()
    
    # Generate room code
    room_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    print(f"\n★ Your Room Code: {room_code}")
    print("★ Share this code with the other peer!\n")
    
    # Start chat client
    chat = WebRTCChat()
    session = await chat.connect_signaling(room_code)
    
    await asyncio.sleep(1)
    
    # Start clipboard monitoring
    chat.clipboard_monitor_task = asyncio.create_task(chat.start_clipboard_monitor())
    
    print("\n[Clipboard sync active. Press Ctrl+C to quit]\n")
    
    try:
        # Keep running until interrupted
        while True:
            await asyncio.sleep(1)
    finally:
        await chat.close()
        await session.close()
        await server.stop()


async def run_join():
    print("=== JOIN MODE ===\n")
    
    server_ip = input("Enter host IP address (or press Enter for localhost): ").strip()
    if not server_ip:
        server_ip = "localhost"
    
    room_code = input("Enter 6-digit room code: ").strip()
    
    server_url = f"http://{server_ip}:8080"
    print(f"\n[Connecting to {server_url}...]\n")
    
    chat = WebRTCChat()
    session = await chat.connect_signaling(room_code, server_url)
    
    await asyncio.sleep(1)
    
    # Start clipboard monitoring
    chat.clipboard_monitor_task = asyncio.create_task(chat.start_clipboard_monitor())
    
    print("\n[Clipboard sync active. Press Ctrl+C to quit]\n")
    
    try:
        # Keep running until interrupted
        while True:
            await asyncio.sleep(1)
    finally:
        await chat.close()
        await session.close()


async def main():
    parser = argparse.ArgumentParser(description='WebRTC Chat with 6-Digit Code')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--host', action='store_true', help='Host mode (creates room)')
    group.add_argument('--join', action='store_true', help='Join mode (joins room)')
    
    args = parser.parse_args()
    
    if args.host:
        await run_host()
    else:
        await run_join()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nGoodbye!")