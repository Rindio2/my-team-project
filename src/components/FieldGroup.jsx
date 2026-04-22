export default function FieldGroup({ id, label, className = '', hint = '', children }) {
  const wrapperClassName = ['input-group', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}
