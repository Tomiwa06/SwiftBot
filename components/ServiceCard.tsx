import React from 'react';
import { ServiceItem } from '../types';

interface ServiceCardProps {
  service: ServiceItem;
  onClick: (serviceName: string) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  return (
    <div 
      onClick={() => onClick(service.title)}
      className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-[#ce1126]/30 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1.5 h-0 bg-[#ce1126] group-hover:h-full transition-all duration-300"></div>
      
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 w-fit drop-shadow-sm filter grayscale-[0.2] group-hover:grayscale-0">
        {service.icon}
      </div>
      <h3 className="text-lg font-extrabold text-[#001740] mb-2 group-hover:text-[#ce1126] transition-colors font-heading tracking-tight">
        {service.title}
      </h3>
      <p className="text-slate-600 text-sm leading-relaxed flex-grow font-medium">
        {service.description}
      </p>
      <div className="mt-4 text-[#ce1126] text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        Book Appointment <span>&rarr;</span>
      </div>
    </div>
  );
};

export default ServiceCard;