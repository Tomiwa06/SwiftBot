import React from 'react';
import { LOGO_URL } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-start">
        <div className="flex items-center gap-3 select-none hover:opacity-90 transition-opacity cursor-pointer" onClick={() => window.location.reload()}>
            <img 
                src={LOGO_URL} 
                alt="SwiftBooks Logo" 
                className="h-16 w-auto object-contain" 
            />
        </div>
      </div>
    </header>
  );
};

export default Header;