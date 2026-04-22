export default function CommandButton({
  id,
  command,
  label,
  hint = '',
  className = 'btn-secondary',
  type = 'button',
  title,
  fullWidth = false,
  layout = 'tile',
  disabled = false,
  children,
}) {
  const buttonClassName = [className, fullWidth ? 'full-width' : '', layout === 'tile' ? 'command-tile' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      id={id}
      type={type}
      data-command={command}
      className={buttonClassName}
      title={title}
      disabled={disabled}
    >
      {children || (
        <>
          <span className="command-tile-label">{label}</span>
          {hint ? <span className="command-tile-hint">{hint}</span> : null}
        </>
      )}
    </button>
  );
}
