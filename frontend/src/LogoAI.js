import React from 'react';

const ClarifAILogo = ({ className }) => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Upper curved element (red-orange) */}
    <path
      d="M100,30 
         C140,30 170,60 170,100
         C170,115 165,125 155,135
         C145,145 130,152 115,152
         C105,152 95,148 85,140
         C75,132 68,122 65,110"
      fill="url(#grad1)"
      stroke="none"
    />
    
    {/* Lower curved element (blue-turquoise) */}
    <path
      d="M100,170
         C60,170 30,140 30,100
         C30,85 35,75 45,65
         C55,55 70,48 85,48
         C95,48 105,52 115,60
         C125,68 132,78 135,90"
      fill="url(#grad2)"
      stroke="none"
    />
    
    <defs>
      {/* Gradient for the red-orange part */}
      <linearGradient id="grad1" x1="60" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F24C3D" />
        <stop offset="50%" stopColor="#F5762A" />
        <stop offset="100%" stopColor="#F9A826" />
      </linearGradient>
      
      {/* Gradient for the blue-turquoise part */}
      <linearGradient id="grad2" x1="140" y1="160" x2="40" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#22A699" />
        <stop offset="50%" stopColor="#5FBDBB" />
        <stop offset="100%" stopColor="#7ED7C1" />
      </linearGradient>
    </defs>
  </svg>
);

export default ClarifAILogo;