import React, { useEffect, useRef, useCallback } from 'react';

const AsteriskProgressBar = ({ 
  totalSteps, 
  currentStep, 
  size = 100, 
  className = '',
  activeColor = '#ff4d06',
  inactiveColor = '#e2e8f0'
}) => {
  const containerRef = useRef(null);
  const pathElementsRef = useRef([]);
  const centerCircleRef = useRef(null);
  
  // Helper to generate a pseudo-random number from a seed
  const seededRandom = (seed) => {
    const s = Math.sin(seed) * 10000;
    return s - Math.floor(s);
  };

  const generateSpikes = useCallback(() => {
    // Calculate center circle radius to avoid overlap
    const centerRadius = size < 50 ? size * 0.12 : size * 0.08;
    
    return Array.from({ length: totalSteps }, (_, i) => {
      // Adjust proportions for small sizes
      const baseLength = size < 50 ? size * 0.4 : size * 0.45;
      const baseWidth = size < 50 ? size * 0.1 : size * 0.08;

      const lengthRandomness = (seededRandom(i * 10 + 1) - 0.5) * baseLength * 0.3;
      const topWidthRandomness = (seededRandom(i * 10 + 2) - 0.5) * baseWidth * 0.5;
      const bottomWidthRandomness = (seededRandom(i * 10 + 3) - 0.5) * baseWidth * 0.4;
      const topSkewRandomness = (seededRandom(i * 10 + 4) - 0.5) * baseWidth * 0.6;

      const length = baseLength + lengthRandomness;
      const topWidth = baseWidth / 2 + topWidthRandomness;
      const bottomWidth = baseWidth / 2 + bottomWidthRandomness;

      // Start spikes from the edge of the center circle (no gap)
      const startDistance = centerRadius;

      const path = `
        M ${-bottomWidth}, ${-startDistance}
        L ${-topWidth + topSkewRandomness}, ${-length}
        L ${topWidth + topSkewRandomness}, ${-length}
        L ${bottomWidth}, ${-startDistance}
        Z
      `;

      return {
        path: path.trim(),
        rotation: (360 / totalSteps) * i,
      };
    });
  }, [size, totalSteps]);

  const render = useCallback(() => {
    if (!containerRef.current) return;
    
    // Clear previous content
    containerRef.current.innerHTML = '';
    pathElementsRef.current = [];
    centerCircleRef.current = null;
    
    // Set container size
    containerRef.current.style.width = `${size}px`;
    containerRef.current.style.height = `${size}px`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.transform = 'rotate(-90deg)';

    const g = document.createElementNS(svgNS, "g");
    g.setAttribute('transform', `translate(${size / 2}, ${size / 2})`);

    // Add center circle (adjust radius for small sizes)
    const centerCircle = document.createElementNS(svgNS, "circle");
    const centerRadius = size < 50 ? size * 0.12 : size * 0.08; // Larger radius for small sizes
    centerCircle.setAttribute('r', centerRadius);
    centerCircle.setAttribute('fill', activeColor);
    centerCircle.style.transition = 'fill 0.5s ease-in-out';
    centerCircleRef.current = centerCircle;
    g.appendChild(centerCircle);

    const spikes = generateSpikes();
    spikes.forEach(spike => {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute('d', spike.path);
      path.setAttribute('transform', `rotate(${spike.rotation})`);
      path.style.transition = 'fill 0.5s ease-in-out';
      pathElementsRef.current.push(path);
      g.appendChild(path);
    });

    svg.appendChild(g);
    containerRef.current.appendChild(svg);
  }, [size, activeColor, totalSteps, generateSpikes]);

  const update = useCallback(() => {
    pathElementsRef.current.forEach((path, index) => {
      path.setAttribute('fill', index < currentStep ? activeColor : inactiveColor);
    });
    
    // Keep center circle always filled with active color
    if (centerCircleRef.current) {
      centerCircleRef.current.setAttribute('fill', activeColor);
    }
  }, [currentStep, activeColor, inactiveColor]);

  useEffect(() => {
    render();
    update();
  }, [render, update]);

  useEffect(() => {
    update();
  }, [update]);

  if (totalSteps === 0) {
    return <div className={`asterisk-progress-container ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <div 
      ref={containerRef}
      className={`asterisk-progress-container ${className}`}
    />
  );
};

export default AsteriskProgressBar; 