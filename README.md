# theme-color-generator

This script generates color specific styles/less file which you can use to change theme dynamically in browser

## Install
```
$ npm install -D theme-color-generator
```

## Demo
Try out the [demo](https://kingller.github.io/theme-color-generator/)

## Example:

```
const { generateTheme } = require('theme-color-generator');

const options = {
  stylesDir: path.join(__dirname, './src/styles'), // styles directory containing all less files
  varFile: path.join(__dirname, './src/styles/variables.less'), // include all color variables in `varFile` that you want to change dynamically
  globalVarFile: path.join(__dirname, './src/styles/global-variables.less'), // (Optional) which less variables in the file will replace css variables in all less files. For example, if @primary-1 is defined in the file, var(--primary-1) will be replaced by @primary-1.
  globalVarFileThemeRegex: /@primary-/, // (Optional) regex codes to match your color variable values which variables are related to theme color in colorVarFile. most of the time you don't need this.
  findMissVar: false, // (Optional) boolean. The default value is false. If the variable referenced in globalVarFile is not found in varFile, it will look for the import file and add it.
  themeVariables: ['@theme-color'], // (Optional) Specify variables to use (If not set, all variables in varFile will be used). most of the time you don't need this.
  outputFilePath: path.join(__dirname, './public/color.less'), // if provided, file will be created with generated less/styles
  include: ['./**/*.less'], // (Optional) Specify the included file. Here is its default value. It will be used as path.join(stylesDir, './**/*.less') to relative path.
  options: {} // (Optional) less options
}

generateTheme(options).then(less => {
  console.log('Theme generated successfully');
})
.catch(error => {
  console.log('Error', error);
})
```
## Note: include all color variables in `varFile` that you want to change dynamically and assign them unique color codes. Don't assign same color to two or more variables and don't use `#fff`, `#ffffff`, `#000` or `#000000`. If you still want white or black color as default, slightly change it e.g. `#fffffe` or `#000001` which will not replace common background colors from other components.

## You can switch theme in two ways:

### First way
Add following lines in your main html file

```
<link rel="stylesheet/less" type="text/css" href="/color.less" />
<script>
  window.less = {
    async: false,
    env: 'production'
  };
</script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/less.js/4.2.0/less.min.js"></script>
```

Now you can update colors by updating less variables like this

```
window.less.modifyVars({
  '@theme-color': '#0035ff'
})
```

### Second way
You can go to [theme-color-switch](https://github.com/kingller/theme-color-switch) to see the usage