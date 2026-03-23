import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitStrategyStatus(data: { type: string; running: boolean; isDryRun: boolean; startedAt?: string }) {
    this.server.emit('strategy:status', data);
  }

  emitPositionUpdate(position: any) {
    this.server.emit('position:update', position);
  }

  emitTradeExecuted(trade: any) {
    this.server.emit('trade:executed', trade);
  }

  emitLog(log: { strategyType: string; level: string; message: string; metadata?: any; createdAt: string }) {
    this.server.emit('log:entry', log);
  }

  emitStatsUpdate(stats: any) {
    this.server.emit('stats:update', stats);
  }
}
