const path = require('path');
const { generateTheme } = require('theme-color-generator');

const options = {
    stylesDir: path.join(__dirname, './src/styles'),
    varFile: path.join(__dirname, './src/styles/vars.less'),
    mainLessFile: path.join(__dirname, './src/styles/main.less'),
    themeVariables: [
        '@primary-color',
        '@secondary-color'
    ],
    outputFilePath: path.join(__dirname, './public/color.less'),
}

generateTheme(options).then(less => {
    console.log('Theme generated successfully');
}).catch(error => {
    console.log('Error', error);
});