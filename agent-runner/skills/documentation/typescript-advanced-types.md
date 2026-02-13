function identity&#x3C;T>(value: T): T {
return value;
}const num = identity&#x3C;number>(42); // Type: number
const str = identity&#x3C;string>("hello"); // Type: string
const auto = identity(true); // Type inferred: boolean