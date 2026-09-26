// behavior relative to one known stable release boundary
export type IVersionBehavior = 'before' | 'after';

// one observed package declaration, independent of dependency eligibility
export interface IVersionBehaviorDeclaration {
  readonly declaredRange: string;
}
