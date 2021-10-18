import React from 'react';

type ProgressProps = {
  value: number;
  label?: string;
  className?: string;
};

const Progress: React.FC<ProgressProps> = ({ value, label }) => {
  return (
    <div className="flex items-center">
      <div className="bg-blue-200 h-1 mr-2 flex-1">
        <div className="h-1 bg-blue-600" style={{ width: `${value}%` }}></div>
      </div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  );
};

export default Progress;
