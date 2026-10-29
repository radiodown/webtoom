import React from 'react';

export function routeHref(id) {
  const base = import.meta.env.BASE_URL;
  if (id === 'characters') return `${base}?view=characters`;
  if (id?.startsWith('character:')) return `${base}?view=characters&character=${encodeURIComponent(id.slice(10))}`;
  return `${base}${id ? `?episode=${encodeURIComponent(id)}` : ''}`;
}

export function routeId() {
  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'characters') return params.get('character') ? `character:${params.get('character')}` : 'characters';
  return params.get('episode')?.padStart(2, '0') || null;
}

export default function NavigationLink({ id, navigate, children, ...props }) {
  return <a href={routeHref(id)} {...props} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(id);
  }}>{children}</a>;
}
