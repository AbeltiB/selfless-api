import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { SOCKET_EVENTS } from 'selfless-sdk';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  async afterInit(server: Server) {
    if (process.env.REDIS_URL) {
      const pubClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
      const subClient = pubClient.duplicate();
      pubClient.on('error', (err) => console.error(`Realtime Redis pub error: ${err.message}`));
      subClient.on('error', (err) => console.error(`Realtime Redis sub error: ${err.message}`));
      server.adapter(createAdapter(pubClient as any, subClient as any));
    }
  }

  handleConnection(client: Socket) {
    console.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_BRANCH)
  joinBranch(@ConnectedSocket() client: Socket, @MessageBody() data: { branchId: string }) {
    client.join(`branch:${data.branchId}`);
    return { event: 'joined', room: `branch:${data.branchId}` };
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_QUEUE)
  joinQueue(@ConnectedSocket() client: Socket, @MessageBody() data: { queueId: string }) {
    client.join(`queue:${data.queueId}`);
    return { event: 'joined', room: `queue:${data.queueId}` };
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_BRANCH)
  leaveBranch(@ConnectedSocket() client: Socket, @MessageBody() data: { branchId: string }) {
    client.leave(`branch:${data.branchId}`);
  }

  emitToBranch(branchId: string, event: string, data: unknown) {
    this.server?.to(`branch:${branchId}`).emit(event, data);
  }

  emitToQueue(queueId: string, event: string, data: unknown) {
    this.server?.to(`queue:${queueId}`).emit(event, data);
  }
}
