import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that at least one optional field in the DTO has a defined value.
 * Prevents empty update requests from hitting the database.
 */
@ValidatorConstraint({ name: 'atLeastOneField', async: false })
class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    return Object.values(object).some((v) => v !== undefined && v !== null);
  }

  defaultMessage(): string {
    return 'At least one field must be provided for update';
  }
}

/**
 * Class-level decorator: ensures at least one field is set.
 * Apply to a dummy property in the DTO.
 */
export function AtLeastOneField(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: AtLeastOneFieldConstraint,
    });
  };
}
