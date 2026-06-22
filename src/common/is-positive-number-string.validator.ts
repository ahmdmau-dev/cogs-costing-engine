import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// Validates that a value is a numeric string strictly greater than 0, and (optionally) <= max.
export function IsPositiveNumberString(max?: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPositiveNumberString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          const n = Number(value);
          if (!Number.isFinite(n) || n <= 0) return false;
          return max === undefined || n <= max;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a number string > 0${max !== undefined ? ` and <= ${max}` : ''}`;
        },
      },
    });
  };
}
