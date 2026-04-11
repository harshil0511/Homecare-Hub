"""WebSocket connection manager for Emergency SOS real-time updates."""

import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EmergencyConnectionManager:
    """
    Tracks two pools of WebSocket connections:
    - user_connections[request_id]  → single WebSocket for the user watching their SOS
    - servicer_connections[provider_id] → single WebSocket for a servicer watching for alerts
    """

    def __init__(self):
        # request_id (str UUID) → WebSocket
        self.user_connections: Dict[str, WebSocket] = {}
        # provider_id (str UUID) → WebSocket
        self.servicer_connections: Dict[str, WebSocket] = {}

    async def connect_user(self, request_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_connections[request_id] = websocket
        logger.info(f"User connected to emergency WS: request_id={request_id}")

    def disconnect_user(self, request_id: str) -> None:
        self.user_connections.pop(request_id, None)
        logger.info(f"User disconnected from emergency WS: request_id={request_id}")

    async def connect_servicer(self, provider_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.servicer_connections[provider_id] = websocket
        logger.info(f"Servicer connected to emergency alert WS: provider_id={provider_id}")

    def disconnect_servicer(self, provider_id: str) -> None:
        self.servicer_connections.pop(provider_id, None)
        logger.info(f"Servicer disconnected from emergency alert WS: provider_id={provider_id}")

    async def send_to_user(self, request_id: str, payload: dict) -> None:
        """Push a JSON message to the user watching this emergency request."""
        ws = self.user_connections.get(str(request_id))
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"Failed to send to user (request_id={request_id}): {e}")
                self.disconnect_user(str(request_id))

    async def send_to_servicer(self, provider_id: str, payload: dict) -> None:
        """Push a JSON message to a connected servicer."""
        ws = self.servicer_connections.get(str(provider_id))
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"Failed to send to servicer (provider_id={provider_id}): {e}")
                self.disconnect_servicer(str(provider_id))

    async def broadcast_alert_to_servicers(
        self, provider_ids: List, payload: dict
    ) -> None:
        """Send emergency_alert to all selected connected servicers."""
        for pid in provider_ids:
            await self.send_to_servicer(str(pid), payload)


# Singleton — shared across all routes and WebSocket handlers
emergency_manager = EmergencyConnectionManager()
