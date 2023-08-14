const fs = require('fs');
const path = require('path');
const glob = require('glob');
const postcss = require('postcss');
const less = require('less');
const bundle = require('less-bundle-promise');
const hash = require('hash.js');
const NpmImportPlugin = require('less-plugin-npm-import');
const lessToJs = require('less-vars-to-js');
var CleanCSS = require('clean-css');

let hashCache = '';
let cssCache = '';

function randomColor() {
    return '#' + ((Math.random() * 0xffffff) << 0).toString(16);
}

/*
  Recursively get the color code assigned to a variable e.g.
  @theme-color: #1890ff;
  @link-color: @theme-color;
 
  @link-color -> @theme-color ->  #1890ff
  Which means
  @link-color: #1890ff
*/
function getColor(varName, mappings) {
    const color = mappings[varName];
    if (color in mappings) {
        return getColor(color, mappings);
    } else {
        return color;
    }
}
/*
  Read following files and generate color variables and color codes mapping
    - Your own variables.less
  It will generate map like this
  {
    '@theme-color': '#00375B',
    '@info-color': '#1890ff',
    '@success-color': '#52c41a',
    '@error-color': '#f5222d',
    '@normal-color': '#d9d9d9',
    '@primary-6': '#1890ff',
    '@heading-color': '#fa8c16',
    '@text-color': '#cccccc',
    ....
  }
*/
function generateColorMap(content) {
    return content
        .split('\n')
        .filter((line) => line.startsWith('@') && line.indexOf(':') > -1)
        .reduce((prev, next) => {
            try {
                const matches = next.match(/(?=\S*['-])([@a-zA-Z0-9'-]+).*:[ ]{1,}(.*);/);
                if (!matches) {
                    return prev;
                }
                let [, varName, color] = matches;
                // if (color && color.startsWith("@")) {
                //   color = getColor(color, prev);
                //   if (!isValidColor(color)) return prev;
                //   prev[varName] = color;
                // } else if (isValidColor(color)) {
                //   prev[varName] = color;
                // }
                prev[varName] = color;
                return prev;
            } catch (e) {
                console.log('e', e);
                return prev;
            }
        }, {});
}

function generateColorFileVarMap({ colorFile, colorFileThemeRegex }) {
    const themeVarsRegex = colorFileThemeRegex || /@primary-\d/;
    if (colorFile) {
        let colorVarJs = lessToJs(fs.readFileSync(colorFile, 'utf8'));
        Object.keys(colorVarJs).forEach((varName) => {
            if (!themeVarsRegex.test(varName)) {
                delete colorVarJs[varName];
            }
        });
        return colorVarJs;
    }
    return {};
}

/*
 This plugin will remove all css rules except those are related to colors
 e.g.
 Input: 
 .body { 
    font-family: 'Lato';
    background: #cccccc;
    color: #000;
    padding: 0;
    pargin: 0
 }

 Output: 
  .body {
    background: #cccccc;
    color: #000;
 }
*/
const reducePlugin = postcss.plugin('reducePlugin', (themeCompiledVars) => {
    const cleanRule = (rule) => {
        if (rule.selector.startsWith('.main-color .palatte-')) {
            rule.remove();
            return;
        }
        let themeValues = Object.values(themeCompiledVars);
        let removeRule = true;
        rule.walkDecls((decl) => {
            let isNotColorProp =
                (!decl.prop.includes('color') &&
                    !decl.prop.includes('background') &&
                    !decl.prop.includes('border') &&
                    !decl.prop.includes('box-shadow') &&
                    !decl.prop.includes('outline') &&
                    !decl.prop.includes('stroke')) ||
                (!decl.value.includes('#') && !decl.value.includes('rgb') && !decl.value.includes('hsl'));

            let isThemeColor = false;
            if (!isNotColorProp) {
                for (let i = 0; i < themeValues.length; i++) {
                    isThemeColor = decl.value.includes(themeValues[i]);
                    if (isThemeColor) {
                        break;
                    }
                }
            }

            if (!isThemeColor) {
                decl.remove();
            } else {
                removeRule = false;
            }
        });
        if (removeRule) {
            rule.remove();
        }
    };
    return (css) => {
        css.walkAtRules((atRule) => {
            atRule.remove();
        });

        css.walkRules(cleanRule);

        css.walkComments((c) => c.remove());
    };
});

function getMatches(string, regex) {
    const matches = {};
    let match;
    while ((match = regex.exec(string))) {
        if (match[2].startsWith('rgba') || match[2].startsWith('#')) {
            matches[`@${match[1]}`] = match[2];
        }
    }
    return matches;
}

/*
  This function takes less input as string and compiles into css.
*/
function render(text, options) {
    return less.render.call(
        less,
        text,
        Object.assign(
            {
                javascriptEnabled: true,
                plugins: [new NpmImportPlugin({ prefix: '~' })],
            },
            options
        )
    );
}

/*
  This funtion reads a less file and create an object with keys as variable names 
  and values as variables respective values. e.g.
  //variabables.less
    @theme-color : #1890ff;
    @heading-color : #fa8c16;
    @text-color : #cccccc;
  
    to

    {
      '@theme-color' : '#1890ff',
      '@heading-color' : '#fa8c16',
      '@text-color' : '#cccccc'
    }

*/
function getLessVars(filePath) {
    const sheet = fs.readFileSync(filePath).toString();
    const lessVars = {};
    const matches = sheet.match(/@(.*:[^;]*)/g) || [];

    matches.forEach((variable) => {
        const definition = variable.split(/:\s*/);
        const varName = definition[0].replace(/['"]+/g, '').trim();
        lessVars[varName] = definition.splice(1).join(':');
    });
    return lessVars;
}

/*
  This function take theme color palette name and returns @theme-color dependent value
  .e.g 
  Input: @theme-1
  Output: color(~`colorPalette("@{theme-color}", ' 1 ')`)
*/
function getShade(varName) {
    let [, className, number] = varName.match(/(.*)-(\d)/);
    if (/theme-\d/.test(varName)) className = '@theme-color';
    return 'color(~`colorPalette("@{' + className.replace('@', '') + '}", ' + number + ')`)';
}

/*
  This function takes color string as input and return true if string is a valid color otherwise returns false.
  e.g.
  isValidColor('#ffffff'); //true
  isValidColor('#fff'); //true 
  isValidColor('rgba(0, 0, 0, 0.5)'); //true
  isValidColor('20px'); //false
*/
function isValidColor(color) {
    if (!color || color.match(/px/g)) return false;
    if (color.match(/colorPalette|fade|shade|tint/g)) return true;
    if (color.charAt(0) === '#') {
        color = color.substring(1);
        return [3, 4, 6, 8].indexOf(color.length) > -1 && !isNaN(parseInt(color, 16));
    }
    return /^(rgb|hsl)a?\((\d+%?(deg|rad|grad|turn)?[,\s]+){2,3}[\s\/]*[\d\.]+%?\)$/i.test(color);
}

// 替换 CSS 中的变量
function replaceCssVariablesToLess({ filePath, colorFile, importedVariables }) {
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    if (
        !importedVariables ||
        Object.keys(importedVariables).length === 0 ||
        !source ||
        !/var\(--(.*?)\)/.test(source)
    ) {
        return source;
    }

    // 把 CSS 变量替换成 less 变量
    let cssToLessVariables = source.replace(/var\(--(.*?)\)/g, (_, variableName) => {
        const lessVarName = `@${variableName.trim()}`;
        return importedVariables[lessVarName] ? lessVarName : _;
    });
    // import colorFile 编译替换的 less 变量
    cssToLessVariables = `@import '${colorFile}';\n${cssToLessVariables}`;
    return cssToLessVariables;
}

function getCssModulesStyles(stylesDir, include, options, colorFile) {
    let styles = [];
    if (include) {
        if (!Array.isArray(include)) {
            include = null;
            console.error("theme-color-generator: Compiler option 'include' requires a value of type Array");
        }
    }
    if (!include || include.length === 0) {
        include = ['./**/*.less'];
    }
    include.forEach(function (dir) {
        if (dir && /^(\.{0,2}|~)\//.test(dir)) {
            dir = path.join(stylesDir, dir);
        }
        styles.push(...glob.sync(dir));
    });

    let importedVariables = null;
    if (colorFile) {
        // 读取 colorFile 变量文件内容
        const lessVarContent = fs.readFileSync(colorFile, 'utf-8');

        // 获取所有导入的变量
        importedVariables = lessToJs(lessVarContent);
    }

    return Promise.all(
        styles.map((p) =>
            less
                .render(
                    replaceCssVariablesToLess({ filePath: p, colorFile, importedVariables }),
                    Object.assign(
                        {
                            paths: [stylesDir],
                            filename: path.resolve(p),
                            javascriptEnabled: true,
                            plugins: [new NpmImportPlugin({ prefix: '~' })],
                        },
                        options
                    )
                )
                .catch(() => '\n')
        )
    )
        .then((csss) => csss.map((c) => c.css).join('\n'))
        .catch((err) => {
            console.log('Error', err);
            return '';
        });
}

/*
 remove duplicate css
 */
function uniqueCss(css) {
    if (!css) {
        return '';
    }

    css = new CleanCSS({
        compatibility: 'ie9',
        format: {
            breaks: { afterAtRule: true, afterRuleEnds: true },
        },
    }).minify(css).styles;

    let array = css.split('\n');
    let res = [];
    for (let i = 0, len = array.length; i < len; i++) {
        let current = array[i];
        if (res.indexOf(current) === -1) {
            res.push(current);
        }
    }
    return res.join('\n');
}

/*
  This is main function which call all other functions to generate color.less file which contains all color
  related css rules based on your custom styles
  By default color.less will be generated in /public directory
*/
function generateTheme({
    stylesDir,
    varFile,
    outputFilePath,
    themeVariables,
    include,
    options,
    themeReplacement,
    colorFile,
    colorFileThemeRegex,
}) {
    return new Promise((resolve, reject) => {
        /*
      You own custom styles (Change according to your project structure)
      
      - stylesDir - styles directory containing all less files
      - varFile - variable file containing your custom variables
      - colorFile - which less variables in the file need to be replaced from css variables in all less files
      - colorFileThemeRegex - regex codes to match your color variable values which variables are related to theme color in colorFile
    */
        let content = '';
        // const hashCode = hash.sha256().update(content).digest('hex');
        // if(hashCode === hashCache){
        //   resolve(cssCache);
        //   return;
        // }
        // hashCache = hashCode;
        let themeCompiledVars = {};
        let themeVars = themeVariables || [];
        const lessPaths = [stylesDir];

        return bundle({
            src: varFile,
        })
            .then((colorsLess) => {
                const colorFileVarMapping = generateColorFileVarMap({ colorFile, colorFileThemeRegex });
                const mappings = Object.assign(generateColorMap(colorsLess), colorFileVarMapping);
                const colorFileVarNames = Object.keys(colorFileVarMapping);
                if (colorFileVarNames.length > 0) {
                    if (!/\n$/.test(colorsLess)) {
                        colorsLess += '\n';
                    }
                    colorFileVarNames.forEach((varName) => {
                        colorsLess += `${varName}: ${colorFileVarMapping[varName]};\n`;
                    });
                }
                return [mappings, colorsLess];
            })
            .then(([mappings, colorsLess]) => {
                let css = '';
                /*
         If not pass in themeVariables, the variables in varFile will be used
         */
                if (!themeVariables) {
                    let varJs = Object.assign({}, mappings);
                    themeVars.forEach((varName) => {
                        delete varJs[varName];
                    });
                    themeVars.push(...Object.keys(varJs));
                }
                if (!themeVars.length) {
                    themeVars.push('@theme-color');
                }
                themeVars = themeVars.filter((name) => name in mappings);
                themeVars.forEach((varName) => {
                    const color = mappings[varName];
                    css = `.${varName.replace('@', '')} { color: ${color}; }\n ${css}`;
                });

                css = `${colorsLess}\n${css}`;
                return render(css, Object.assign({ paths: lessPaths }, options)).then(({ css }) => [
                    css,
                    mappings,
                    colorsLess,
                ]);
            })
            .then(([css, mappings, colorsLess]) => {
                css = css.replace(/(\/.*\/)/g, '');
                const regex = /.(?=\S*['-])([.a-zA-Z0-9'-]+)\ {\n\ \ color:\ (.*);/g;
                themeCompiledVars = getMatches(css, regex);
                content = `${content}\n${colorsLess}`;
                return render(content, Object.assign({ paths: lessPaths }, options)).then(({ css }) => {
                    return getCssModulesStyles(stylesDir, include, options, colorFile).then((customCss) => {
                        return [`${customCss}\n${css}`, mappings, colorsLess];
                    });
                });
            })
            .then(([css, mappings, colorsLess]) => {
                return postcss([reducePlugin(themeCompiledVars)])
                    .process(css, {
                        parser: less.parser,
                        from: varFile,
                    })
                    .then(({ css }) => [css, mappings, colorsLess]);
            })
            .then(([css, mappings, colorsLess]) => {
                Object.keys(themeCompiledVars).forEach((varName) => {
                    let color;
                    // if (/(.*)-(\d)/.test(varName)) {
                    //     color = themeCompiledVars[varName];
                    //     varName = getShade(varName);
                    // } else {
                    color = themeCompiledVars[varName];
                    // }
                    color = color.replace('(', '\\(').replace(')', '\\)');
                    css = css.replace(new RegExp(`${color}`, 'g'), varName);
                });

                css = `${colorsLess}\n${css}`;

                themeVars.reverse().forEach((varName) => {
                    css = css.replace(new RegExp(`${varName}(\ *):(.*);`, 'g'), '');
                    let varValue = mappings[varName];
                    if (themeReplacement && typeof themeReplacement === 'object' && themeReplacement[varName]) {
                        varValue = themeReplacement[varName];
                    }
                    css = `${varName}: ${varValue};\n${css}\n`;
                });
                css = css.replace(/\n+/g, '\n');

                css = uniqueCss(css);

                if (outputFilePath) {
                    const folderDirMatch = outputFilePath.match(/(.*\/)[^\/]+$/);
                    if (folderDirMatch) {
                        const folderDir = folderDirMatch[1];
                        if (!fs.existsSync(folderDir)) {
                            fs.mkdirSync(folderDir);
                        }
                    }
                    fs.writeFileSync(outputFilePath, css);
                    console.log(`Theme generated successfully. OutputFile: ${outputFilePath}`);
                } else {
                    console.log(`Theme generated successfully`);
                }
                cssCache = css;
                return resolve(css);
            })
            .catch((err) => {
                console.log('Error', err);
                reject(err);
            });
    });
}

module.exports = {
    generateTheme,
    isValidColor,
    getLessVars,
    randomColor,
    renderLessContent: render,
};
