import React from 'react';
import { TooltipData } from '../types';

interface TooltipProps {
  data: TooltipData;
}

export const Tooltip: React.FC<TooltipProps> = ({ data }) => {
  if (!data.visible) return null;

  // Check if this is an edge tooltip (has sourceName)
  if (data.sourceName && data.targetName) {
    return (
      <div
        className="fixed z-50 bg-white border-2 border-neutral-800 rounded-lg px-3 py-2 shadow-cartoon pointer-events-none transform translate-x-4 translate-y-4 font-comic"
        style={{ left: data.x, top: data.y }}
      >
        <div className="text-xs text-neutral-500 mb-1 font-bold uppercase tracking-wider">Connection</div>
        <div className="flex items-center gap-2 text-sm font-extrabold text-neutral-900">
          <span>{data.sourceName}</span>
          <span className="text-neutral-400">↔</span>
          <span>{data.targetName}</span>
        </div>
        <div className="mt-1 pt-1 border-t border-gray-100 text-xs text-neutral-600 font-bold">
          <div className="mb-1 text-xs text-neutral-500 uppercase tracking-wider">Score</div>
          {data.connections && data.connections.length > 0 ? (
             <div className="flex flex-col gap-1">
                {data.connections.map((conn, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                        <span className="text-[10px] text-neutral-800 mr-2">
                           {conn.sourceName}<span className="text-gray-400 mx-1">→</span>{conn.targetName}
                        </span>
                        <span className="text-blue-500 font-mono text-[10px]">{conn.score.toFixed(2)}</span>
                    </div>
                ))}
             </div>
          ) : (
            <span>Score: <span className="text-blue-500">{data.score?.toFixed(2)}</span></span>
          )}
        </div>
      </div>
    );
  }

  // Node Tooltip
  const isHub = data.type === 'hub';

  return (
    <div
      className="fixed z-50 bg-white border-2 border-neutral-800 rounded-lg px-3 py-2 shadow-cartoon pointer-events-none transform translate-x-4 translate-y-4 font-comic"
      style={{ left: data.x, top: data.y }}
    >
      <strong className="block text-neutral-900 text-sm mb-1 font-extrabold">
        {data.name}
      </strong>
      <div className="text-xs text-neutral-600">ID: {data.id}</div>
      <div className="text-xs text-neutral-600 mb-1">
        Score: {data.score?.toFixed(2)}
      </div>
      <span
        className={`inline-block px-2 py-0.5 rounded-xl text-[10px] font-bold border-2 ${
          isHub
            ? 'bg-red-400 text-white border-red-700'
            : 'bg-blue-400 text-white border-blue-700'
        }`}
      >
        {isHub ? '核心节点' : '普通节点'}
      </span>
    </div>
  );
};