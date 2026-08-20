# mini-nest

## Як запустити

Локально:

```bash
npm ci
npm test
```

`npm test` сам компілює проєкт перед прогоном (`pretest` → `tsc`). 
pretest потрібен, бо esbuild/vite не вміє емітити design:paramtypes

У Docker:

```bash
docker compose run --rm api npm test
```

(образ не прямо з ДЗ#5, бо сервер зараз не потрібен.
Тут `npm ci` без `--omit=dev`, бо vitest/typescript, які потрібні для запуску тестів, знаходяться в devDependencies)

## Як це працює

TypeScript вміє класти в рантайм-метадані типи параметрів конструктора —
але тільки за двох умов одночасно:

1. `"emitDecoratorMetadata": true` у `tsconfig.json` — прапорець, що каже
   компілятору емітити цю метадану.
2. На класі має висіти хоча б один декоратор — без нього компілятор не
   вважає клас "цікавим" і `design:paramtypes` просто не з'явиться, навіть
   якщо `emitDecoratorMetadata` увімкнено.

Коли обидві умови виконані, `tsc` компілює

```ts
@Injectable()
class UserService {
    constructor(private db: Database) {}
}
```

у щось типу

```js
__decorate([
    Injectable(),
    __metadata("design:paramtypes", [Database])
], UserService);
```

Контейнер (`src/container.ts`) читає 'design:paramtypes' через
`Reflect.getMetadata('design:paramtypes', Target)`, рекурсивно резолвить 
кожен тип і викликає `new Target(...instances)`.

Для випадків, коли типу недостатньо (інтерфейси в рантаймі стираються до
`Object`), є `@Inject(token)` — параметр-декоратор, що прив'язує конкретний
`Symbol`/рядок до індексу параметра (`src/decorators/inject.ts`), і контейнер
резолвить за токеном (`container.register(token, value)`), а не за типом.

Детекція циклів (`A -> B -> A`) — контейнер веде `Set` шляху
резолву й передає його рекурсивно; при вході в клас, що вже у `path`, кидає
помилку з повним ланцюгом замість `RangeError: Maximum call stack size
exceeded`.
