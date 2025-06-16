# 📦 angular-rich-text-editor

A powerful, fully-configurable **Angular wrapper** for [RichTextEditor.com](https://richtexteditor.com), built for modern Angular apps. Supports both **Reactive & Template-Driven Forms**, **modals**, **file uploads**, **custom toolbars**, validation, dynamic content injection, and much more.

> 🔥 Built for scalability, optimized for performance, and engineered for flexibility.

---

## ✨ Features

- 🧩 Works with `FormControl`, `[(ngModel)]`, and standalone forms
- 📤 Customizable image/file upload
- 🧠 Preset and dynamic toolbar options
- 📱 Mobile-friendly toolbar responsiveness
- ✅ Validation with custom messages
- 💬 Full error messaging & touched state integration
- 🔁 Public API for dynamic HTML manipulation
- 🚀 Easy integration inside components or modals

---

## 🚀 Installation

```bash
npm install angular-rich-text-editor
```

---

## 🔧 Configuration

> This library depends on assets and runtime scripts from [RichTextEditor.com](https://richtexteditor.com). These must be added manually.

### 1. Modify `angular.json` or `project.json`

#### Scripts

> ⚠️ Make sure to keep your existing script. Just **append** the following to the `"script"` array in your `angular.json` or `project.json`:

```json
"scripts": [
  ...
  "node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte.js"
]
```

#### Styles

> ⚠️ Make sure to keep your existing styles. Just **append** the following to the `"styles"` array in your `angular.json` or `project.json`:

```json
"styles": [
  ...
  "node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte_theme_default.css"
]
```

#### Assets

> 📁 To load the required runtime assets, **append** the following entry to the `"assets"` array in your `angular.json` or `project.json`.  
> ✅ Don’t remove your existing asset entries — just add this below them:

```json
"assets": [
  ...,
  {
    "glob": "**/*",
    "input": "node_modules/angular-rich-text-editor/src/assets/richtexteditor",
    "output": "assets/richtexteditor"
  }
]
```

````

---

## 🧱 Module Import

### In a regular NgModule:

```ts
import { RichTextEditorModule } from 'angular-rich-text-editor';

@NgModule({
  imports: [RichTextEditorModule],
})
export class YourModule {}
````

### With standalone components:

```ts
@Component({
  standalone: true,
  imports: [RichTextEditorModule],
  ...
})
```

---

## 🧩 Usage Examples

### 1. Template-Driven Form

```html
<lib-rich-text-editor [(ngModel)]="content" [rtePreset]="'FULL'" [enableImageUpload]="true" [fileUploadHandler]="handleFileUpload" />
```

### 2. Reactive Form

```html
<form [formGroup]="form">
  <lib-rich-text-editor formControlName="description" [initialContent]="startingHTML" [enableVideoEmbed]="true" />
</form>
```

### 3. In a Modal

```html
<lib-rich-text-editor [(ngModel)]="content" [fileUploadHandler]="mockUpload" [excludedToolbarItems]="['insertvideo', 'insertcode']" />
```

### 4. Shared Component Wrapper

```html
<app-shared-rich-text-editor [(ngModel)]="emailBody" [imageToolbarItems]="['imagestyle', 'delete']" [excludedToolbarItems]="['html2pdf']" [fileUploadHandler]="uploadImage" />
```

---

## ⚙️ Inputs

| Input                            | Type                                                 | Description                           |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| `formControl`, `formControlName` | `FormControl`                                        | Works with reactive forms             |
| `[(ngModel)]`                    | `string`                                             | Supports template-driven forms        |
| `initialContent`                 | `string`                                             | Set initial content as HTML string    |
| `rtePreset`                      | `'BASIC' \| 'STANDARD' \| 'FULL' \| 'MINIMAL'`       | Select a toolbar preset configuration |
| `imageToolbarItems`              | `Array<'menu_controlsize' \| 'imagecaption' \| ...>` | Configure image inline toolbar        |
| `excludedToolbarItems`           | `string[]`                                           | Toolbar buttons to exclude            |
| `fileUploadHandler`              | `(file, cb, i?, all?) => void`                       | Custom image/file upload handler      |
| `enableImageUpload`              | `boolean`                                            | Enable/disable image uploading        |
| `enableVideoEmbed`               | `boolean`                                            | Enable/disable video embedding        |
| `readonly`                       | `boolean`                                            | Make editor read-only                 |
| `errorMessages`                  | `{ [key: string]: string }`                          | Custom validation error messages      |

---

## 📤 Outputs

| Output           | Type                   | Description                     |
| ---------------- | ---------------------- | ------------------------------- |
| `ngModelChange`  | `EventEmitter<string>` | Emits when HTML content updates |
| `contentChanged` | `EventEmitter<void>`   | Emits after any content change  |
| `blurEvent`      | `EventEmitter<void>`   | Emits on blur                   |
| `focusEvent`     | `EventEmitter<void>`   | Emits on focus                  |

---

## 🔓 Public Methods via `RichTextEditorService`

Inject in your component:

```ts
constructor(private rteService: RichTextEditorService) {}
```

| Method                                     | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `getContent()`                             | Get current HTML from the editor               |
| `setContent(html: string)`                 | Set HTML content programmatically              |
| `clearContent()`                           | Clears all content                             |
| `insertContentAtCursor(html: string)`      | Inject HTML at current cursor                  |
| `focus()`                                  | Focus the editor                               |
| `executeCommand(cmd: string, value?: any)` | Execute RichTextEditor command (bold, link...) |
| `getCharacterCount()`                      | Get plain character count                      |
| `getWordCount()`                           | Get plain word count                           |
| `getSelectedText()`                        | Returns currently selected text                |
| `isReadonly()`                             | Check if editor is read-only                   |
| `isAvailable()`                            | Check if editor is ready                       |
| `hideFloatingPanels()`                     | Hide open floating panels                      |
| `removeLastPlaceholderImage()`             | Removes latest `blob:`/`data:` image inserted  |

---

## ✅ Validation Support

Supports `required` validation with:

- Angular template validation (`required` directive)
- Reactive validation (`Validators.required`)

Checks:

- Empty text
- Absence of image or video

---

## 🎨 Toolbar Presets

You can select a predefined toolbar layout using the `rtePreset` input.

| Preset     | Toolbar Description                       |
| ---------- | ----------------------------------------- |
| `BASIC`    | Light inline editing options              |
| `STANDARD` | Medium-complexity toolbar                 |
| `FULL`     | Rich full-featured editing experience     |
| `MINIMAL`  | Ultra-compact, minimal formatting buttons |

```ts
export type RTEPreset = "BASIC" | "STANDARD" | "FULL" | "MINIMAL";
```

---

## 🖼️ Image Toolbar Items

Customize the image selection toolbar using the supported `RTEImageTool` values:

```ts
export type RTEImageTool = "menu_controlsize" | "imagecaption" | "controlalt" | "controlinsertlink" | "controleditlink" | "controlopenlink" | "controlunlink" | "menu_controljustify" | "imagestyle" | "delete";
```

#### Example:

```html
<lib-rich-text-editor [imageToolbarItems]="['menu_controljustify', 'imagestyle', 'delete']" />
```

---

## 📁 File Upload Handler

Custom uploader example:

```ts
handleFileUpload(file: File, cb: (url: string | null) => void) {
  uploadToS3(file).then(url => cb(url));
}
```

Simulate failure:

```ts
simulateFailingUpload(file, cb) {
  setTimeout(() => cb(null, 'mock-error'), 1000);
}
```

---

## 📘 Styles & Assets

Ensure that `/assets/richtexteditor` is correctly linked in your build config.  
Required scripts and styles must be added (see Configuration section above).

---

## 🧪 Development & Testing Notes

- Editor uses an `iframe`, which may need `fixture.whenStable()` or `setTimeout()` in tests.
- Mock internal methods like `getContent()` for assertions.
- Use `zone.run()` to manually trigger change detection if needed.

---

## 🛡️ License Key

You can inject globally:

```ts
providers: [{ provide: RTE_LICENSE_KEY, useValue: "your-license-key" }];
```

Or pass directly to the component:

```html
<lib-rich-text-editor [licenseKey]="'your-license-key'"></lib-rich-text-editor>
```

---

## 🤝 Contributing

1. Fork or clone the repo
2. Run `npm start` (once demo is available)
3. Add new features or fix issues
4. Submit a clean PR with a clear description

---

## 🧭 Roadmap

- [ ] Interactive playground / demo
- [ ] Storybook docs
- [ ] JSON content support
- [ ] Plugin registration API
- [ ] Drag & drop blocks / content snippets

---

## 🙌 Credits

- Built on [RichTextEditor.com](https://richtexteditor.com)
- Built with ❤️ and TypeScript

---

## 💬 Need Help?

Start a discussion or file an issue:  
👉 [https://github.com/manishpatidar028/angular-rich-text-editor](https://github.com/manishpatidar028/angular-rich-text-editor)
