import React from 'react';

const ClarifAILogo = ({ className }) => (
  <svg 
    width="60" 
    height="60" 
    viewBox="0 0 200 200" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <path 
      d="M100 20C55.8172 20 20 55.8172 20 100C20 144.183 55.8172 180 100 180C144.183 180 180 144.183 180 100C180 55.8172 144.183 20 100 20Z" 
      fill="white" 
    />
    <path 
      d="M142 65C123.5 48 106.5 66 94 76.5C82.5 63.5 56 53.5 44 76.5C32 99.5 68.5 104.5 94 95C102 102 128.5 139 159.5 115C190.5 91 160.5 82 142 65Z" 
      fill="url(#paint0_linear)" 
    />
    <path 
      d="M58 130C76.5 147 93.5 129 106 118.5C117.5 131.5 144 141.5 156 118.5C168 95.5 131.5 90.5 106 100C98 93 71.5 56 40.5 80C9.5 104 39.5 113 58 130Z" 
      fill="url(#paint1_linear)" 
    />
    <defs>
      <linearGradient id="paint0_linear" x1="44" y1="76.5" x2="159.5" y2="115" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#F2994A" />
        <stop offset="0.5" stopColor="#E15A46" />
        <stop offset="1" stopColor="#E15A46" />
      </linearGradient>
      <linearGradient id="paint1_linear" x1="156" y1="118.5" x2="40.5" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#48A1B0" />
        <stop offset="0.7" stopColor="#366B95" />
        <stop offset="1" stopColor="#274676" />
      </linearGradient>
    </defs>
  </svg>
);

export default ClarifAILogo;