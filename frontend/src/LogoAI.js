import React from 'react';

const ClarifAILogo = ({ className }) => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Arco superiore: rosso-arancio */}
    <path
      d="M100,40
         C135,35 160,65 150,100
         C145,120 120,130 100,120"
      fill="none"
      stroke="url(#grad1)"
      strokeWidth="28"
      strokeLinecap="round"
    />
    {/* Arco inferiore: azzurro-blu */}
    <path
      d="M100,160
         C65,165 40,135 50,100
         C55,80 80,70 100,80"
      fill="none"
      stroke="url(#grad2)"
      strokeWidth="28"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="grad1" x1="60" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F2994A"/>
        <stop offset="1" stopColor="#E15A46"/>
      </linearGradient>
      <linearGradient id="grad2" x1="140" y1="160" x2="40" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#48A1B0"/>
        <stop offset="1" stopColor="#274676"/>
      </linearGradient>
    </defs>
  </svg>
);

export default ClarifAILogo;