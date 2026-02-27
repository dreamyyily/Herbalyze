module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          10: '#E6F0FF',
          20: '#C7D9FF',
          30: '#84A9FF',
          40: '#3366FF', 
          50: '#2563EB',
          60: '#1E40AF',
          70: '#1E3A8A',
          80: '#1E293B',
        },
        warning: {
          10: '#FFEDC8',
          20: '#FFD889',
          30: '#FFC858',
          40: '#FFB92C',
          50: 'var(--color-warning-50)',
        },
        dark: {
          10: '#F1F3F5',
          20: '#E2E4E7',
          30: '#5F6368',  
          40: '#3E4348',
          50: '#202124',  
        },
        light: {
          10: '#FFFFFF',
          20: '#F9FAFB',  
          30: '#F7F8FA',
          40: '#E9ECF0',  
          50: '#D1D5DB',
        },
        danger: {
          30: '#EF4444',  
        },
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const fontConvention = {
        bold: {
          24: { fontWeight: 700, fontSize: '24px', lineHeight: '32px' },  
          16: { fontWeight: 700, fontSize: '16px', lineHeight: '24px' },  
        },
        regular: {
          16: { fontWeight: 400, fontSize: '16px', lineHeight: '24px' },  
          15: { fontWeight: 400, fontSize: '15px', lineHeight: '22px' }, 
          14: { fontWeight: 400, fontSize: '14px', lineHeight: '20px' },  
          12: { fontWeight: 400, fontSize: '12px', lineHeight: '16px' }, 
        },
      };

      const newUtilities = {};
      for (const weight in fontConvention) {
        for (const size in fontConvention[weight]) {
          newUtilities[`.text-${weight}-${size}`] = fontConvention[weight][size];
        }
      }

      addUtilities(newUtilities);
    },
  ],
};