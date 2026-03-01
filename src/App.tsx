/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Hardware } from './system/Hardware';
import { KeyCode } from './system/InputManager';
import { Bug, Power, MessageSquare, Settings, Terminal } from 'lucide-react';
import { COLORS, LAYOUT } from './system/Theme';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hardwareRef = useRef<Hardware | null>(null);
  const [powerState, setPowerState] = useState<'OFF' | 'BOOTING' | 'ON'>('OFF');
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    if (canvasRef.current && !hardwareRef.current) {
      console.log("App: Initializing Hardware");
      hardwareRef.current = new Hardware(canvasRef.current);
      hardwareRef.current.start();
      
      const interval = setInterval(() => {
        if (hardwareRef.current) {
          setPowerState(hardwareRef.current.getPowerState());
        }
      }, 100);
      
      return () => {
        console.log("App: Cleaning up Hardware");
        clearInterval(interval);
        if (hardwareRef.current) {
          hardwareRef.current.stop();
          hardwareRef.current = null;
        }
      };
    }
  }, []);

  const handleKeyDown = (key: KeyCode) => {
    if (hardwareRef.current) {
      hardwareRef.current.getInputManager().pressKey(key);
    }
  };

  const handleKeyUp = (key: KeyCode) => {
    if (hardwareRef.current) {
      hardwareRef.current.getInputManager().releaseKey(key);
    }
  };

  const debugAction = (action: (os: any) => void) => {
    if (hardwareRef.current) {
      action(hardwareRef.current.getOS());
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-4 font-sans select-none overflow-hidden relative">
      {/* Draggable Debug Window */}
      {showDebug && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ x: -350, y: -200 }}
          className="fixed z-50 w-64 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl text-white pointer-events-auto cursor-move"
        >
          <div className="flex items-center justify-between mb-4 pb-2 border-bottom border-white/10">
            <div className="flex items-center gap-2">
              <Bug size={16} className="text-emerald-400" />
              <span className="text-xs font-bold tracking-widest uppercase">Debug Link</span>
            </div>
            <button onClick={() => setShowDebug(false)} className="hover:text-red-400 transition-colors">
              <Settings size={14} />
            </button>
          </div>

          <div className="space-y-2">
            <DebugButton 
              icon={<Power size={14} />} 
              label="Force Power On" 
              onClick={() => debugAction(os => os.debugForcePowerOn())} 
            />
            <DebugButton 
              icon={<MessageSquare size={14} />} 
              label="Trigger SMS" 
              onClick={() => debugAction(os => os.debugTriggerSMS())} 
            />
            <DebugButton 
              icon={<Terminal size={14} />} 
              label="Jump to Debug Menu" 
              onClick={() => debugAction(os => os.debugJumpToMenu('DEBUG_MENU'))} 
            />
            <DebugButton 
              icon={<Settings size={14} />} 
              label="Jump to Settings" 
              onClick={() => debugAction(os => os.debugJumpToMenu('SET_MENU'))} 
            />
            <DebugButton 
              icon={<Bug size={14} />} 
              label="System Reset" 
              onClick={() => debugAction(os => os.debugSystemReset())} 
            />
            <DebugButton 
              icon={<Terminal size={14} />} 
              label="Force Render Frame" 
              onClick={() => debugAction(os => os.debugForceRender())} 
            />
          </div>

          <div className="mt-4 pt-2 border-t border-white/10 text-[10px] opacity-50 flex justify-between">
            <span>Status: {powerState}</span>
            <span>v2.1.0-MOD</span>
          </div>
        </motion.div>
      )}

      <div className="phone-body bg-linear-to-br from-[#e6e6eb] to-[#a1a1aa] w-[340px] h-[780px] p-[20px] rounded-[45px] border-4 border-[#777] shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_2px_10px_white] relative">
        {/* Power LED */}
        <div className={`absolute top-6 right-10 w-2 h-2 rounded-full transition-colors duration-300 ${powerState === 'ON' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : powerState === 'BOOTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-950'}`} />
        
        {/* Screen Area */}
        <div className="screen-bezel bg-[#111] p-2 rounded-xl shadow-[inset_0_0_15px_black] border border-[#444] h-[310px] overflow-hidden flex items-start justify-center">
          <canvas
            id="master-lcd"
            ref={canvasRef}
            width={LAYOUT.SCREEN_WIDTH}
            height={LAYOUT.SCREEN_HEIGHT}
            style={{ width: `${LAYOUT.SCREEN_WIDTH}px`, height: `${LAYOUT.SCREEN_HEIGHT}px`, transform: 'scale(1.8)', transformOrigin: 'top center' }}
            className="bg-[#1a1a1a] border-2 border-black [image-rendering:pixelated] block mb-[128px]"
          />
        </div>

          {/* Keypad Area */}
          <div className="mt-5 px-1 grid grid-cols-3 gap-2">
            {/* Row 1 */}
            <KeyButton label="MENU" onDown={() => handleKeyDown('SOFT_L')} onUp={() => handleKeyUp('SOFT_L')} className="text-[10px]" />
            <KeyButton label="▲" onDown={() => handleKeyDown('UP')} onUp={() => handleKeyUp('UP')} className="text-base" />
            <KeyButton label="IDLE" onDown={() => handleKeyDown('SOFT_R')} onUp={() => handleKeyUp('SOFT_R')} className="text-[10px]" />

            {/* Row 2 */}
            <KeyButton label="SEND" onDown={() => handleKeyDown('CALL')} onUp={() => handleKeyUp('CALL')} className="text-green-800" />
            <KeyButton label="▼" onDown={() => handleKeyDown('DOWN')} onUp={() => handleKeyUp('DOWN')} className="text-base" />
            <KeyButton label="END / PWR" onDown={() => handleKeyDown('END')} onUp={() => handleKeyUp('END')} className="text-red-800" />

            {/* Number Pad (Rows 3-6) */}
            <NumKey num="1" sub="SMS" onDown={() => handleKeyDown('1')} onUp={() => handleKeyUp('1')} />
            <NumKey num="2" sub="ABC" onDown={() => handleKeyDown('2')} onUp={() => handleKeyUp('2')} />
            <NumKey num="3" sub="DEF" onDown={() => handleKeyDown('3')} onUp={() => handleKeyUp('3')} />
            <NumKey num="4" sub="GHI" onDown={() => handleKeyDown('4')} onUp={() => handleKeyUp('4')} />
            <NumKey num="5" sub="JKL" onDown={() => handleKeyDown('5')} onUp={() => handleKeyUp('5')} />
            <NumKey num="6" sub="MNO" onDown={() => handleKeyDown('6')} onUp={() => handleKeyUp('6')} />
            <NumKey num="7" sub="PQRS" onDown={() => handleKeyDown('7')} onUp={() => handleKeyDown('7')} />
            <NumKey num="8" sub="TUV" onDown={() => handleKeyDown('8')} onUp={() => handleKeyUp('8')} />
            <NumKey num="9" sub="WXYZ" onDown={() => handleKeyDown('9')} onUp={() => handleKeyUp('9')} />
            <NumKey num="*" sub="SYM" onDown={() => handleKeyDown('*')} onUp={() => handleKeyUp('*')} />
            <NumKey num="0" sub="SPACE" onDown={() => handleKeyDown('0')} onUp={() => handleKeyUp('0')} />
            <NumKey num="#" sub="SHIFT" onDown={() => handleKeyDown('#')} onUp={() => handleKeyUp('#')} />
          </div>
      </div>
      
      {/* Branding Overlay */}
      <div className="fixed bottom-4 right-4 flex items-center gap-4">
        {!showDebug && (
          <button 
            onClick={() => setShowDebug(true)}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-emerald-400 transition-all shadow-lg"
          >
            <Bug size={16} />
          </button>
        )}
        <div className="text-white/20 text-xs pointer-events-none">
          Samsoft Afterthought A200 v2.1 Modular
        </div>
      </div>
    </div>
  );
}

function KeyButton({ label, onDown, onUp, className = "" }: { label: string, onDown: () => void, onUp: () => void, className?: string }) {
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onDown();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onUp();
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`bg-linear-to-b from-white to-[#b1b1b8] border border-[#777] rounded-lg py-2 text-center shadow-[0_3px_0_#555] cursor-pointer font-bold text-xs active:translate-y-[2px] active:shadow-[0_1px_0_#333] active:bg-[#ddd] transition-all select-none touch-none ${className}`}
    >
      {label}
    </button>
  );
}

function NumKey({ num, sub, onDown, onUp }: { num: string, sub: string, onDown: () => void, onUp: () => void }) {
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onDown();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onUp();
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="bg-linear-to-b from-white to-[#b1b1b8] border border-[#777] rounded-lg py-2 text-center shadow-[0_3px_0_#555] cursor-pointer font-bold text-xs active:translate-y-[2px] active:shadow-[0_1px_0_#333] active:bg-[#ddd] transition-all select-none touch-none"
    >
      {num}<br /><span className="text-[7px] font-normal opacity-70">{sub}</span>
    </button>
  );
}

function DebugButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-left group"
    >
      <div className="text-emerald-400 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[11px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
