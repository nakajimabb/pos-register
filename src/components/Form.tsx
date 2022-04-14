import React, { CSSProperties } from 'react';
import clsx from 'clsx';

type LabelProps = {
  htmlFor?: string;
  className?: string;
  style?: CSSProperties;
};

const Label: React.FC<LabelProps> = ({ htmlFor, className, children, style }) => {
  return (
    <label htmlFor={htmlFor} className={clsx('leading-normal focus:shadow-outline', className)} style={style}>
      {children}
    </label>
  );
};

type InputType = 'text' | 'password' | 'number' | 'date' | 'datetime-local' | 'time' | 'checkbox' | 'radio';

type InputProps = {
  id?: string;
  name?: string;
  value?: string;
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  innerRef?: React.RefObject<HTMLInputElement>;
  className?: string;
  style?: CSSProperties;
};

const Input: (type: InputType) => React.FC<InputProps> =
  (type) =>
  ({
    id,
    name,
    value,
    label,
    checked,
    disabled,
    required,
    placeholder,
    min,
    max,
    size = 'md',
    autoComplete = 'off',
    onChange,
    onKeyPress,
    onBlur,
    innerRef,
    className,
    style,
  }) => {
    const padding = { sm: 'px-2 py-1', md: 'px-3 py-1.5', lg: 'px-4 py-2' };
    const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
    const baseClass = 'rounded border leading-tight border-gray-300 shadow-md';
    const checkbox = type === 'checkbox' || type === 'radio';

    const input = (
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        onChange={onChange}
        onKeyPress={onKeyPress}
        onBlur={onBlur}
        ref={innerRef}
        className={clsx(
          baseClass,
          textSize[size],
          padding[size],
          !checkbox && 'block',
          // checkbox && 'focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          className
        )}
        style={style}
      />
    );

    return checkbox && label ? (
      <Label htmlFor={id}>
        {input}
        <span className="pl-2">{label}</span>
      </Label>
    ) : (
      input
    );
  };

type SelectProps = {
  id?: string;
  name?: string;
  value?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  options: { label: string; value: string }[] | string[];
  size?: 'sm' | 'md' | 'lg';
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  className?: string;
  style?: CSSProperties;
};

const Select: React.FC<SelectProps> = ({
  id,
  name,
  value,
  label,
  disabled,
  required,
  options,
  size = 'md',
  onChange,
  className,
  style,
}) => {
  const padding = { sm: 'px-2 py-1', md: 'px-3 py-1.5', lg: 'px-4 py-2' };
  const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
  const baseClass = 'text-base block border border-gray-300 rounded shadow-md';

  return (
    <select
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      required={required}
      onChange={onChange}
      className={clsx(baseClass, padding[size], textSize[size], className)}
      style={style}
    >
      {label && <option value="">{label}</option>}
      {options.map((option: { label: string; value: string } | string, index: number) =>
        typeof option === 'string' ? (
          <option key={index} value={option}>
            {option}
          </option>
        ) : (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        )
      )}
    </select>
  );
};

type TextAreaProps = {
  id?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  className?: string;
  style?: CSSProperties;
};

const TextArea: React.FC<TextAreaProps> = ({
  id,
  name,
  value,
  placeholder,
  rows,
  required,
  onChange,
  className,
  style,
}) => {
  const baseClass = 'block shadow-md border-gray-300 p-2';

  return (
    <textarea
      id={id}
      name={name}
      value={value}
      placeholder={placeholder}
      rows={rows}
      required
      onChange={onChange}
      className={clsx(baseClass, className)}
      style={style}
    />
  );
};

const InputText = Input('text');
const InputPassword = Input('password');
const InputNumber = Input('number');
const InputDate = Input('date');
const InputDateTime = Input('datetime-local');
const InputTime = Input('time');
const InputCheckbox = Input('checkbox');
const InputRadio = Input('radio');

type FormProps = {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  style?: CSSProperties;
};

type FormType = React.FC<FormProps> & {
  Label: typeof Label;
  Text: typeof InputText;
  Password: typeof InputPassword;
  Number: typeof InputNumber;
  Date: typeof InputDate;
  DateTime: typeof InputDateTime;
  Time: typeof InputTime;
  Checkbox: typeof InputCheckbox;
  Radio: typeof InputRadio;
  Select: typeof Select;
  TextArea: typeof TextArea;
};

const Form: FormType = ({ onSubmit, className, children, style }) => {
  return (
    <form onSubmit={onSubmit} className={className} style={style}>
      {children}
    </form>
  );
};

Form.Text = InputText;
Form.Password = InputPassword;
Form.Number = InputNumber;
Form.Label = Label;
Form.Date = InputDate;
Form.DateTime = InputDateTime;
Form.Time = InputTime;
Form.Checkbox = InputCheckbox;
Form.Radio = InputRadio;
Form.Select = Select;
Form.TextArea = TextArea;

export default Form;
