import { ReactNode } from "react";

interface SewingBackgroundProps {
  children: ReactNode;
}

export const SewingBackground = ({ children }: SewingBackgroundProps) => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-rose-50 via-amber-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
      
      {/* Sewing pattern overlay */}
      <div className="fixed inset-0 opacity-[0.03] dark:opacity-[0.05]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sewingPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              {/* Thread spools */}
              <circle cx="25" cy="25" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
              <circle cx="25" cy="25" r="4" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              
              {/* Scissors shape */}
              <path d="M70 20 L80 30 M80 20 L70 30" stroke="currentColor" strokeWidth="1" fill="none"/>
              <circle cx="68" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              <circle cx="82" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              
              {/* Needle and thread */}
              <line x1="10" y1="70" x2="40" y2="70" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2"/>
              <ellipse cx="45" cy="70" rx="4" ry="2" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              
              {/* Button */}
              <circle cx="75" cy="75" r="6" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              <circle cx="73" cy="73" r="1" fill="currentColor"/>
              <circle cx="77" cy="73" r="1" fill="currentColor"/>
              <circle cx="73" cy="77" r="1" fill="currentColor"/>
              <circle cx="77" cy="77" r="1" fill="currentColor"/>
              
              {/* Dotted stitch line */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.3" strokeDasharray="4,4"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sewingPattern)" />
        </svg>
      </div>
      
      {/* Floating decorative elements */}
      <div className="fixed top-20 left-10 w-16 h-16 opacity-10 animate-float">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M14.12 14.12L12 22l-2.12-7.88L2 12l7.88-2.12L12 2l2.12 7.88L22 12l-7.88 2.12z"/>
        </svg>
      </div>
      
      <div className="fixed bottom-20 right-20 w-20 h-20 opacity-10 animate-float" style={{ animationDelay: '1s' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="9" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="15" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="15" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      
      <div className="fixed top-1/3 right-10 w-12 h-12 opacity-10 animate-float" style={{ animationDelay: '2s' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5"/>
          <circle cx="5" cy="5" r="3"/>
          <circle cx="19" cy="5" r="3"/>
        </svg>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
