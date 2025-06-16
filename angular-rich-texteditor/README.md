# 📦 angular-rich-text-editor

A powerful, fully-configurable **Angular wrapper** for [RichTextEditor.com](https://richtexteditor.com), built for modern apps. Supports both **Reactive & Template-Driven Forms**, **modal dialogs**, **file uploads**, custom toolbars, validation, content injection, and much more.

> 🔥 Built for scalability, with real-world use cases and performance-optimized for Angular.

---

## ✨ Features

- 🧩 FormControl & `[(ngModel)]` support
- 📤 File/image upload with full control
- 🧠 Presets and toolbar customization
- 📱 Responsive toolbar with mobile fallbacks
- 📌 Editor state access (get, set, insert, clear, etc.)
- ✅ Validation (`required`, image/video presence)
- 💬 Custom error messaging
- 🚀 Easy integration inside **modals**, **shared components**, or **standalone forms**

---

## 🚀 Installation

```bash
npm install angular-rich-text-editor
```

---

## 🔧 Configuration

> This library depends on the assets and scripts provided by RichTextEditor.com. You must include them in your Angular/Nx build.

### 1. Modify `angular.json` or `project.json`:

#### Scripts

```json
"scripts": [
 ...
  "node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte.js"
]
```

#### Styles

```json
"styles": [
  ...
  "node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte_theme_default.css"
]
```

#### Assets

```json
"assets": [
 ...
  {
    "glob": "**/*",
    "input": "node_modules/angular-rich-text-editor/src/assets/richtexteditor",
    "output": "assets/richtexteditor"
  }
]
```

---

## 🧱 Module Import

### With Angular Modules:

```ts
import { RichTextEditorModule } from "angular-rich-text-editor";

@NgModule({
  imports: [RichTextEditorModule],
})
export class YourModule {}
```

### Standalone Components:

```ts
@Component({
  standalone: true,
  imports: [RichTextEditorModule],
  ...
})
```

---

## 🧩 Usage Examples

### 1. Basic Template-Driven Form

```html
<lib-rich-text-editor [(ngModel)]="content" [rtePreset]="'FULL'" [enableImageUpload]="true" [fileUploadHandler]="handleFileUpload"></lib-rich-text-editor>
```

---

### 2. Reactive Form Usage

```html
<form [formGroup]="form">
  <lib-rich-text-editor formControlName="description" [initialContent]="startingHTML" [enableVideoEmbed]="true"></lib-rich-text-editor>
</form>
```

---

### 3. Inside a Modal

```html
<lib-rich-text-editor [(ngModel)]="content" [fileUploadHandler]="mockUpload" [excludedToolbarItems]="['insertvideo', 'insertcode']"></lib-rich-text-editor>
```

---

### 4. Wrapped Shared Component

```html
<app-shared-rich-text-editor [(ngModel)]="emailBody" [imageToolbarItems]="['imagestyle', 'delete']" [excludedToolbarItems]="['html2pdf']" [fileUploadHandler]="uploadImage"></app-shared-rich-text-editor>
```

---

## ⚙️ Inputs

| Input                            | Type                                       | Description                    |
| -------------------------------- | ------------------------------------------ | ------------------------------ |
| `formControl`, `formControlName` | `FormControl`                              | Works with reactive forms      |
| `[(ngModel)]`                    | `string`                                   | Supports template-driven forms |
| `initialContent`                 | `string`                                   | Sets initial HTML content      |
| `rtePreset`                      | `'BASIC' \| 'FULL' \| 'EMAIL' \| 'INLINE'` | Toolbar config preset          |
| `imageToolbarItems`              | `Array<string \| '/'>`                     | Custom image toolbar items     |
| `excludedToolbarItems`           | `string[]`                                 | Remove items from toolbar      |
| `fileUploadHandler`              | `(file, cb, i?, all?) => void`             | Handle image upload            |
| `enableImageUpload`              | `boolean`                                  | Toggle image uploads           |
| `enableVideoEmbed`               | `boolean`                                  | Toggle video embedding         |
| `readonly`                       | `boolean`                                  | Make the editor read-only      |
| `errorMessages`                  | `{ [key: string]: string }`                | Custom validation messages     |

---

## 📤 Outputs

| Output           | Type                   | Description                |
| ---------------- | ---------------------- | -------------------------- |
| `ngModelChange`  | `EventEmitter<string>` | Emits updated HTML content |
| `contentChanged` | `EventEmitter<void>`   | Emits when content changes |
| `blurEvent`      | `EventEmitter<void>`   | Emits on blur              |
| `focusEvent`     | `EventEmitter<void>`   | Emits on focus             |

---

## 🔓 Public Methods (via `RichTextEditorService`)

Import the service in your component:

```ts
constructor(private rteService: RichTextEditorService) {}
```

### Available Methods

| Method                                     | Description                                   |
| ------------------------------------------ | --------------------------------------------- |
| `getContent(): string`                     | Get current HTML content                      |
| `setContent(html: string): boolean`        | Set editor content                            |
| `clearContent(): boolean`                  | Clears the editor                             |
| `insertContentAtCursor(html: string)`      | Injects HTML at current cursor                |
| `focus()`                                  | Focus the editor                              |
| `executeCommand(cmd: string, value?: any)` | Exec command like `bold`, `insertImage`, etc. |
| `getCharacterCount(): number`              | Returns character count                       |
| `getWordCount(): number`                   | Returns word count                            |
| `getSelectedText(): string`                | Returns selected text                         |
| `isReadonly(): boolean`                    | Is editor read-only?                          |
| `isAvailable(): boolean`                   | Is editor ready?                              |
| `hideFloatingPanels()`                     | Hides all tool panels                         |
| `removeLastPlaceholderImage()`             | Removes last uploaded `blob:`/`data:` image   |

---

## ✅ Validation Support

You can validate if content is empty using:

- `required` directive on template
- Angular's `Validators.required` in reactive forms

It checks:

- text content
- image presence
- video presence

---

## 🎨 Toolbar Presets

| Preset   | Toolbar Style             |
| -------- | ------------------------- |
| `BASIC`  | Minimal for inline fields |
| `FULL`   | Full editor experience    |
| `EMAIL`  | Email-focused tools       |
| `INLINE` | Inline editing UI         |

Customize toolbar via:

- `excludedToolbarItems`
- `imageToolbarItems`

---

## 📁 File Upload Handler

Write your own uploader:

```ts
handleFileUpload(file: File, cb: (url: string | null) => void) {
  uploadToS3(file).then(url => cb(url));
}
```

Simulate failure (for testing):

```ts
simulateFailingUpload(file, cb) {
  setTimeout(() => cb(null, 'mock-error'), 1000);
}
```

---

## 📘 Styles & Assets

Assets are expected to be served under `/assets/richtexteditor`.  
You **must copy** them via `angular.json` or `project.json` asset rules as explained above.

---

## 🧪 Development & Testing Notes

- Editor uses `iframe`, so DOM-based tests may require `fixture.detectChanges()` with delay.
- Use `spyOn(service, 'setContent')` or `getContent` for mocking in unit tests.
- Use `zone.run()` when simulating blur/focus in test specs.

---

## 🛡️ License Key

You can inject license globally or per component:

```ts
providers: [{ provide: RTE_LICENSE_KEY, useValue: "your-license-key" }];
```

Or via input:

```html
<lib-rich-text-editor [licenseKey]="'your-license-key'"></lib-rich-text-editor>
```

---

## 🤝 Contributing

1. Clone the repo
2. Run `npm start` to launch local playground (coming soon)
3. Update editor or presets
4. PR with clean commits + test coverage

---

## 🧭 Roadmap

- [ ] Playground app with demos
- [ ] JSON-to-editor binding
- [ ] Custom variable insertion UI
- [ ] Plugin registration API

---

## 🙌 Credits

- Powered by [RichTextEditor.com](https://richtexteditor.com)
- Built with ❤️

---

## 💬 Need Help?

File an issue or start a discussion on [GitHub](https://github.com/manishpatidar028/angular-rich-text-editor)
