import type {ComponentPropsWithoutRef} from 'react';

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'type' | 'aria-label'> & {
  label: string;
};

export function DismissButton({label,className='gp-btn',...props}:Props) {
  return <button {...props} type="button" className={className?className+' gp-dismiss-button':'gp-dismiss-button'}
    aria-label={label} title={label}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m4 4 8 8m0-8-8 8"/>
    </svg>
  </button>;
}
