import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CocktailLoadingAnimationProps {
  className?: string;
}

const LOADING_MESSAGES = [
  'Analyzing your blend...',
  'Checking synergies...',
  'Reviewing dosages...',
  'Checking interactions...',
  'Mixing it up...',
  'Almost ready...',
];

export function CocktailLoadingAnimation({ className }: CocktailLoadingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<'pour' | 'shake' | 'serve'>('pour');

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    const phaseInterval = setInterval(() => {
      setPhase((prev) => {
        if (prev === 'pour') return 'shake';
        if (prev === 'shake') return 'serve';
        return 'pour';
      });
    }, 3000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(phaseInterval);
    };
  }, []);

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {/* Cocktail Animation Container */}
      <div className="relative w-48 h-48 mb-6">
        {/* Shaker */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-500',
            phase === 'shake' && 'animate-[shake_0.3s_ease-in-out_infinite]'
          )}
        >
          <svg viewBox="0 0 100 120" className="w-32 h-32">
            {/* Shaker Body */}
            <defs>
              <linearGradient id="shakerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Shaker cap */}
            <path
              d="M30 15 L70 15 L65 30 L35 30 Z"
              fill="url(#shakerGradient)"
              className="drop-shadow-sm"
            />
            <ellipse cx="50" cy="15" rx="20" ry="5" fill="url(#shakerGradient)" />

            {/* Shaker body */}
            <path
              d="M35 30 L30 100 L70 100 L65 30 Z"
              fill="url(#shakerGradient)"
              className="drop-shadow-md"
            />

            {/* Liquid inside */}
            <path
              d={
                phase === 'pour'
                  ? 'M36 85 L69 85 L68 95 L33 95 Z'
                  : phase === 'shake'
                  ? 'M34 50 L66 50 L68 95 L33 95 Z'
                  : 'M35 60 L65 60 L68 95 L33 95 Z'
              }
              fill="url(#liquidGradient)"
              className="transition-all duration-500"
            />

            {/* Shine effect */}
            <path
              d="M40 35 L42 90 L38 90 L36 35 Z"
              fill="white"
              fillOpacity="0.2"
            />

            {/* Bubbles during shake */}
            {phase === 'shake' && (
              <>
                <circle cx="45" cy="60" r="3" fill="white" fillOpacity="0.4" className="animate-ping" />
                <circle cx="55" cy="70" r="2" fill="white" fillOpacity="0.3" className="animate-ping" style={{ animationDelay: '0.2s' }} />
                <circle cx="50" cy="80" r="2.5" fill="white" fillOpacity="0.35" className="animate-ping" style={{ animationDelay: '0.4s' }} />
              </>
            )}
          </svg>
        </div>

        {/* Falling ingredients during pour phase */}
        {phase === 'pour' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-primary/60 animate-[fall_1s_ease-in_infinite]"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Sparkles during serve phase */}
        {phase === 'serve' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute text-primary animate-pulse"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 40}%`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                ✨
              </div>
            ))}
          </div>
        )}

        {/* Ice cubes */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-sm bg-gradient-to-br from-white/80 to-white/40 border border-white/20',
                phase === 'shake' && 'animate-bounce'
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Loading Text */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-primary animate-pulse">
          {LOADING_MESSAGES[messageIndex]}
        </p>
        <div className="flex items-center justify-center gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      {/* Custom keyframes */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px); opacity: 1; }
          100% { transform: translateY(100px); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-5px) rotate(-3deg); }
          75% { transform: translateX(5px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
