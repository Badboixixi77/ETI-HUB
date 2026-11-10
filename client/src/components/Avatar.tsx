import { cn, initials, avatarColor } from '../lib/utils';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  online?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({ name, size = 'md', className, online }: AvatarProps) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full font-medium text-white',
          sizeClasses[size],
          avatarColor(name),
        )}
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-ink-900',
            online ? 'bg-green-500' : 'bg-ink-300',
          )}
        />
      )}
    </div>
  );
}
