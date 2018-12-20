# theme-color-generator

This script generates color specific styles/less file which you can use to change theme dynamically in browser

## Install
```
$ npm install theme-color-generator
```

## Demo
Try out the [demo](https://kingller.github.io/theme-color-generator/)

## Example:

```
const { generateTheme } = require('theme-color-generator');

const options = {
  stylesDir: path.join(__dirname, './src/styles'), // styles directory containing all less files
  varFile: path.join(__dirname, './src/styles/variables.less'), // include all color variables in `varFile` that you want to change dynamically
  mainLessFile: path.join(__dirname, './src/styles/index.less'), // (Optional) less main file which imports all styles
  themeVariables: ['@theme-color'], // (Optional) Specify variables to use (If not set, all variables in varFile will be used)
  outputFilePath: path.join(__dirname, './public/color.less') // if provided, file will be created with generated less/styles
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
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/less.js/2.7.2/less.min.js"></script>
```

Now you can update colors by updating less avriables like this

```
window.less.modifyVars({
  '@theme-color': '#0035ff'
})
```

### Second way
You can go to [theme-color-toggle](https://github.com/kingller/theme-color-toggle) to see the usage