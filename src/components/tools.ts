export const makeResponsiveClasses = (str: string, attr: string) => {
  if (str) {
    return str
      .split(' ')
      .filter((s) => s)
      .map((s) => {
        const strs = s.split(':');
        return strs.length === 1
          ? `${attr}-${strs[0]}`
          : `${strs[0]}:${attr}-${strs[1]}`;
      })
      .join(' ');
  }
};
