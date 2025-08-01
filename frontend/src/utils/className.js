// src/utils/className.js
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Alternative simple clsx implementation
export function clsx(...args) {
  const classes = [];
  
  for (const arg of args) {
    if (!arg) continue;
    
    if (typeof arg === 'string') {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      classes.push(clsx(...arg));
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if (arg[key]) {
          classes.push(key);
        }
      }
    }
  }
  
  return classes.join(' ');
}