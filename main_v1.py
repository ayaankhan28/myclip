"""
Simple WebRTC Chat - Run two instances on the same laptop

Installation:
pip install aiortc

Usage:
Terminal 1: python chat.py --port 8000
Terminal 2: python chat.py --port 8001

Then follow the prompts to exchange offer/answer between terminals.
"""

import asyncio
import json
import argparse
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCDataChannel
from aiortc.contrib.signaling import object_from_string, object_to_string


class WebRTCChat:
    def __init__(self):
        self.pc = RTCPeerConnection()
        self.channel = None
        
    def on_message(self, message):
        """Called when a message is received"""
        print(f"\n[Received]: {message}")
        print("Enter message (or 'quit'): ", end='', flush=True)
    
    async def create_offer(self):
        """Create an offer (Peer 1)"""
        # Create data channel
        self.channel = self.pc.createDataChannel("chat")
        self.channel.on("message", self.on_message)
        
        # Create offer
        await self.pc.setLocalDescription(await self.pc.createOffer())
        
        # Wait for ICE gathering
        await self.wait_for_ice()
        
        return object_to_string(self.pc.localDescription)
    
    async def create_answer(self, offer_str):
        """Create an answer (Peer 2)"""
        # Set up data channel handler
        @self.pc.on("datachannel")
        def on_datachannel(channel):
            self.channel = channel
            self.channel.on("message", self.on_message)
            print("\n[Connected] Data channel established!")
            print("Enter message (or 'quit'): ", end='', flush=True)
        
        # Set remote description
        offer = object_from_string(offer_str)
        await self.pc.setRemoteDescription(offer)
        
        # Create answer
        await self.pc.setLocalDescription(await self.pc.createAnswer())
        
        # Wait for ICE gathering
        await self.wait_for_ice()
        
        return object_to_string(self.pc.localDescription)
    
    async def set_answer(self, answer_str):
        """Set the answer (Peer 1)"""
        answer = object_from_string(answer_str)
        await self.pc.setRemoteDescription(answer)
        print("\n[Connected] Connection established!")
        print("Enter message (or 'quit'): ", end='', flush=True)
    
    async def wait_for_ice(self):
        """Wait for ICE gathering to complete"""
        while self.pc.iceGatheringState != "complete":
            await asyncio.sleep(0.1)
    
    def send_message(self, message):
        """Send a message through the data channel"""
        if self.channel and self.channel.readyState == "open":
            self.channel.send(message)
            print(f"[Sent]: {message}")
            return True
        else:
            print("[Error] Channel not ready")
            return False
    
    async def close(self):
        """Close the connection"""
        await self.pc.close()


async def run_peer1():
    """Run as Peer 1 (creates offer)"""
    print("=== PEER 1 (Offer Creator) ===\n")
    
    chat = WebRTCChat()
    
    # Create offer
    print("Creating offer...")
    offer = await chat.create_offer()
    
    print("\n" + "="*50)
    print("COPY THIS OFFER AND PASTE IN PEER 2:")
    print("="*50)
    print(offer)
    print("="*50 + "\n")
    
    # Get answer
    print("Waiting for answer from Peer 2...")
    print("Paste the answer here (press Enter when done):\n")
    
    answer_lines = []
    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, input)
        if line.strip() == "":
            break
        answer_lines.append(line)
    
    answer = "\n".join(answer_lines)
    await chat.set_answer(answer)
    
    # Chat loop
    await chat_loop(chat)


async def run_peer2():
    """Run as Peer 2 (creates answer)"""
    print("=== PEER 2 (Answer Creator) ===\n")
    
    chat = WebRTCChat()
    
    # Get offer
    print("Paste the offer from Peer 1 (press Enter twice when done):\n")
    
    offer_lines = []
    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, input)
        if line.strip() == "":
            break
        offer_lines.append(line)
    
    offer = "\n".join(offer_lines)
    
    # Create answer
    print("\nCreating answer...")
    answer = await chat.create_answer(offer)
    
    print("\n" + "="*50)
    print("COPY THIS ANSWER AND PASTE IN PEER 1:")
    print("="*50)
    print(answer)
    print("="*50 + "\n")
    
    # Wait a bit for connection
    await asyncio.sleep(1)
    
    # Chat loop
    await chat_loop(chat)


async def chat_loop(chat):
    """Main chat loop"""
    print("\nYou can now send messages. Type 'quit' to exit.\n")
    
    while True:
        message = await asyncio.get_event_loop().run_in_executor(
            None, input, "Enter message (or 'quit'): "
        )
        
        if message.lower() == 'quit':
            print("Closing connection...")
            await chat.close()
            break
        
        if message.strip():
            chat.send_message(message)


async def main():
    parser = argparse.ArgumentParser(description='Simple WebRTC Chat')
    parser.add_argument('--peer', choices=['1', '2'], required=True,
                       help='Peer number (1 or 2)')
    
    args = parser.parse_args()
    
    if args.peer == '1':
        await run_peer1()
    else:
        await run_peer2()


if __name__ == "__main__":
    asyncio.run(main())
