import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', leading, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'subtle' | 'outline' | 'danger' | 'ghost'; size?: 'sm' | 'md'; leading?: ReactNode }) {
  return <button type={type} className={`btn btn--${variant} btn--${size} ${className}`.trim()} {...props}>{leading ? <span className="btn__icon">{leading}</span> : null}{children}</button>;
}

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={`icon-button ${className}`.trim()} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Panel({ children, className = '', ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`.trim()} {...props}>{children}</section>;
}

export function Badge({ children, tone = 'neutral', dot = false, className = '' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'blue' | 'red' | 'orange' | 'muted'; dot?: boolean; className?: string }) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{dot ? <i aria-hidden="true" /> : null}{children}</span>;
}

export function Modal({ title, kicker, onClose, children, size = 'md' }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; size?: 'md' | 'lg' }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal__header">
        <div>{kicker ? <span className="eyebrow">{kicker}</span> : null}<h2>{title}</h2></div>
        <IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton>
      </header>
      <div className="modal__body">{children}</div>
    </section>
  </div>;
}

export function Field({ label, hint, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className={`form-field ${className}`.trim()}><span>{label}</span><input {...props} />{hint ? <small>{hint}</small> : null}</label>;
}

export function SelectField({ label, children, hint, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return <label className={`form-field ${className}`.trim()}><span>{label}</span><select {...props}>{children}</select>{hint ? <small>{hint}</small> : null}</label>;
}

export function TextAreaField({ label, hint, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return <label className={`form-field ${className}`.trim()}><span>{label}</span><textarea {...props} />{hint ? <small>{hint}</small> : null}</label>;
}

export function Toggle({ label, detail, checked, onChange, disabled = false }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className={`toggle-row ${disabled ? 'toggle-row--disabled' : ''}`}>
    <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <i aria-hidden="true" />
  </label>;
}

export function ProgressBar({ value, tone = 'gold', label, height = 'sm' }: { value: number; tone?: 'gold' | 'blue' | 'green' | 'red' | 'orange'; label?: string; height?: 'sm' | 'md' }) {
  const normalized = Math.max(0, Math.min(100, value));
  return <div className={`progress progress--${tone} progress--${height}`} aria-label={label || `${Math.round(normalized)} percent`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(normalized)}>
    <span style={{ width: `${normalized}%` }} />
  </div>;
}

export function Avatar({ name, size = 'md', className = '' }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
  return <span className={`avatar avatar--${size} ${className}`.trim()} aria-hidden="true">{letters}</span>;
}

export function EmptyState({ icon, title, detail, action }: { icon?: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state__icon">{icon}</span><h3>{title}</h3><p>{detail}</p>{action ? <div>{action}</div> : null}</div>;
}

export function PageHeading({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail?: string; actions?: ReactNode }) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{detail ? <p>{detail}</p> : null}</div>{actions ? <div className="page-heading__actions">{actions}</div> : null}</header>;
}

export function StatCard({ icon, label, value, hint, tone = 'gold' }: { icon: ReactNode; label: string; value: string | number; hint: string; tone?: 'gold' | 'blue' | 'green' | 'red' }) {
  return <article className={`stat-card stat-card--${tone}`}><span className="stat-card__icon">{icon}</span><div><span className="stat-card__label">{label}</span><strong>{value}</strong><small>{hint}</small></div></article>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="skeleton-table" aria-label="Loading records">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}
