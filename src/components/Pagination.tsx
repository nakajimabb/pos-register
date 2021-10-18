import React from 'react';
import clsx from 'clsx';

import { Button, Icon, Flex } from './';

type Props = {
  page: number;
  count: number;
  size: 'sm' | 'md';
  color?: string;
  onChange?: (value: number) => void;
  className?: string;
};

const Pagination: React.FC<Props> = ({
  page,
  count,
  size,
  color,
  onChange,
  className,
  children,
}) => {
  if (count < 2) return null;

  const wh = { sm: 6, md: 8 }[size];

  const pages: number[] = [1];
  for (let pp = page - 1; pp <= page + 1; pp++) {
    if (1 < pp && pp < count) pages.push(pp);
  }
  pages.push(count);

  return (
    <Flex align_items="center">
      <Button
        variant="icon"
        size="none"
        color="none"
        disabled={page === 1}
        onClick={onChange && page > 1 ? () => onChange(page - 1) : undefined}
        className={clsx(
          'mr-1 text-gray-500 hover:bg-gray-200 focus:ring-inset focus:ring-gray-300',
          `w-${wh - 2} h-${wh - 2}`
        )}
      >
        <Icon name="chevron-left" variant="outline" />
      </Button>
      {pages.map((pp, i) => (
        <React.Fragment key={i}>
          {i > 0 && pp - pages[i - 1] > 1 && <>...</>}
          <div
            className={clsx(
              'rounded-full border mx-1 flex justify-center items-center cursor-pointer',
              color && `bg-${color}`,
              pp === page && 'bg-gray-300',
              pp !== page && 'hover:bg-gray-200',
              `w-${wh} h-${wh} text-${size} `
            )}
            onClick={onChange && pp !== page ? () => onChange(pp) : undefined}
          >
            {pp}
          </div>
        </React.Fragment>
      ))}
      <Button
        variant="icon"
        size="none"
        color="none"
        disabled={page === count}
        onClick={
          onChange && page < count ? () => onChange(page + 1) : undefined
        }
        className={clsx(
          'mr-1 text-gray-500 hover:bg-gray-200 focus:ring-inset focus:ring-gray-300',
          `w-${wh - 2} h-${wh - 2}`
        )}
      >
        <Icon name="chevron-right" variant="outline" />
      </Button>
    </Flex>
  );
};

export default Pagination;
