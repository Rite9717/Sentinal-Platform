import { useEffect } from "react";
import { Client } from "@stomp/stompjs";

export const useInstanceUpdates = (userId, onUpdate) => {
    useEffect(() => {
        if(!userId) return;
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws',
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                console.log('WebSocket connected ✓');
                client.subscribe(`/topic/instances/${userId}`, (message) => {
                    const update = JSON.parse(message.body);
                    onUpdate(update);
                });
            },
            onDisconnect: () => {
                console.log('WebSocket disconnected');
            },
            onStompError: (frame) => {
                console.error('WebSocket STOMP error: ', frame);
            }
        });

        client.activate();
        return () => client.deactivate();
    }, [userId, onUpdate]);
};
