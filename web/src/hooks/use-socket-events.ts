'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

export function useSocketEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onStatsUpdate = () => {
      qc.invalidateQueries({ queryKey: ['sim-stats'] });
      qc.invalidateQueries({ queryKey: ['performance'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    };

    const onPositionUpdate = () => {
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    };

    const onTradeExecuted = () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['sim-stats'] });
    };

    const onStrategyStatus = () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    };

    socket.on('stats:update', onStatsUpdate);
    socket.on('position:update', onPositionUpdate);
    socket.on('trade:executed', onTradeExecuted);
    socket.on('strategy:status', onStrategyStatus);

    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.off('position:update', onPositionUpdate);
      socket.off('trade:executed', onTradeExecuted);
      socket.off('strategy:status', onStrategyStatus);
    };
  }, [qc]);
}
