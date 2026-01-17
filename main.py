
"""
Simple WebRTC Chat with 6-Digit Code - Only 2 Terminals Needed!

Installation:
pip install aiortc aiohttp

Usage:
Terminal 1: python chat.py --host
Terminal 2: python chat.py --join

The host creates a 6-digit code, the joiner enters it!
"""

import asyncio
import json
import random
import argparse
import aiohttp
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate


# ============= SIGNALING SERVER (runs in host mode) =============
class SignalingServer:
    def __init__(self):
        self.rooms = {}
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
        
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                data = json.loads(msg.data)
                
                if data['type'] == 'join':
                    room_code = data['code']
                    if room_code not in self.rooms:
                        self.rooms[room_code] = []
                    self.rooms[room_code].append(ws)
                    
                    await ws.send_str(json.dumps({
                        'type': 'joined',
                        'code': room_code,
                        'peers': len(self.rooms[room_code])
                    }))
                    
                    for peer in self.rooms[room_code]:
                        if peer != ws:
                            await peer.send_str(json.dumps({'type': 'peer_joined'}))
                
                elif data['type'] in ['offer', 'answer', 'ice']:
                    if room_code and room_code in self.rooms:
                        for peer in self.rooms[room_code]:
                            if peer != ws:
                                await peer.send_str(msg.data)
        
        if room_code and room_code in self.rooms:
            self.rooms[room_code].remove(ws)
            if not self.rooms[room_code]:
                del self.rooms[room_code]
        
        return ws


# ============= WEBRTC CHAT CLIENT =============
class WebRTCChat:
    def __init__(self):
        self.pc = RTCPeerConnection()
        self.channel = None
        self.ws = None
        self.is_initiator = False
        self.connected = False
        
    def on_message(self, message):
        print(f"\n[Peer]: {message}")
        print(">> ", end='', flush=True)
    
    async def connect_signaling(self, room_code, server_url='http://localhost:8080'):
        session = aiohttp.ClientSession()
        self.ws = await session.ws_connect(f'{server_url}/ws')
        
        await self.ws.send_json({'type': 'join', 'code': room_code})
        asyncio.create_task(self.handle_signaling())
        
        return session
    
    async def handle_signaling(self):
        async for msg in self.ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                
                if data['type'] == 'joined':
                    if data['peers'] == 1:
                        print("[Waiting for peer...]")
                        self.is_initiator = True
                    else:
                        print("[Peer found!]")
                
                elif data['type'] == 'peer_joined':
                    if self.is_initiator:
                        await self.create_offer()
                
                elif data['type'] == 'offer':
                    await self.handle_offer(data['sdp'])
                
                elif data['type'] == 'answer':
                    await self.handle_answer(data['sdp'])
                
                elif data['type'] == 'ice':
                    if data['candidate']:
                        candidate = RTCIceCandidate(
                            sdpMid=data['candidate']['sdpMid'],
                            sdpMLineIndex=data['candidate']['sdpMLineIndex'],
                            candidate=data['candidate']['candidate']
                        )
                        await self.pc.addIceCandidate(candidate)
    
    async def create_offer(self):
        self.channel = self.pc.createDataChannel("chat")
        self.setup_channel()
        
        @self.pc.on("icecandidate")
        async def on_ice(event):
            if event.candidate:
                await self.ws.send_json({
                    'type': 'ice',
                    'candidate': {
                        'candidate': event.candidate.candidate,
                        'sdpMid': event.candidate.sdpMid,
                        'sdpMLineIndex': event.candidate.sdpMLineIndex
                    }
                })
        
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        
        await self.ws.send_json({
            'type': 'offer',
            'sdp': {'type': self.pc.localDescription.type, 'sdp': self.pc.localDescription.sdp}
        })
    
    async def handle_offer(self, sdp):
        @self.pc.on("datachannel")
        def on_datachannel(channel):
            self.channel = channel
            self.setup_channel()
        
        @self.pc.on("icecandidate")
        async def on_ice(event):
            if event.candidate:
                await self.ws.send_json({
                    'type': 'ice',
                    'candidate': {
                        'candidate': event.candidate.candidate,
                        'sdpMid': event.candidate.sdpMid,
                        'sdpMLineIndex': event.candidate.sdpMLineIndex
                    }
                })
        
        await self.pc.setRemoteDescription(RTCSessionDescription(sdp=sdp['sdp'], type=sdp['type']))
        answer = await self.pc.createAnswer()
        await self.pc.setLocalDescription(answer)
        
        await self.ws.send_json({
            'type': 'answer',
            'sdp': {'type': self.pc.localDescription.type, 'sdp': self.pc.localDescription.sdp}
        })
    
    async def handle_answer(self, sdp):
        await self.pc.setRemoteDescription(RTCSessionDescription(sdp=sdp['sdp'], type=sdp['type']))
    
    def setup_channel(self):
        @self.channel.on("open")
        def on_open():
            self.connected = True
            print("\n✓ Connected! You can now chat.\n")
            print(">> ", end='', flush=True)
        
        @self.channel.on("message")
        def on_message(message):
            self.on_message(message)
    
    def send_message(self, message):
        if self.channel and self.channel.readyState == "open":
            self.channel.send(message)
            return True
        return False
    
    async def close(self):
        if self.ws:
            await self.ws.close()
        await self.pc.close()


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
    
    try:
        while True:
            message = await asyncio.get_event_loop().run_in_executor(None, input, ">> ")
            
            if message.lower() == 'quit':
                break
            
            if message.strip():
                if chat.send_message(message):
                    print(f"[You]: {message}")
                else:
                    print("[Waiting for connection...]")
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
    
    try:
        while True:
            message = await asyncio.get_event_loop().run_in_executor(None, input, ">> ")
            
            if message.lower() == 'quit':
                break
            
            if message.strip():
                if chat.send_message(message):
                    print(f"[You]: {message}")
                else:
                    print("[Waiting for connection...]")
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