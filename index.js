const fs = require("fs");
const path = require("path");
const glob = require("glob");
const postcss = require("postcss");
const less = require("less");
const bundle = require("less-bundle-promise");
const hash = require("hash.js");
const NpmImportPlugin = require('less-plugin-npm-import');
const lessToJs = require('less-vars-to-js');

let hashCache = "";
let cssCache = "";

function randomColor() {
  return '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
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
    .split("\n")
    .filter(line => line.startsWith("@") && line.indexOf(":") > -1)
    .reduce((prev, next) => {
      try {
        const matches = next.match(
          /(?=\S*['-])([@a-zA-Z0-9'-]+).*:[ ]{1,}(.*);/
        );
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
        console.log("e", e);
        return prev;
      }
    }, {});
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
const reducePlugin = postcss.plugin("reducePlugin", (themeCompiledVars) => {
  const cleanRule = rule => {
    if (rule.selector.startsWith(".main-color .palatte-")) {
      rule.remove();
      return;
    }
    let themeValues = Object.values(themeCompiledVars);
    let removeRule = true;
    rule.walkDecls(decl => {
      let isNotColorProp = !decl.prop.includes("color") &&
          !decl.prop.includes("background") &&
          !decl.prop.includes("border") &&
          !decl.prop.includes("box-shadow") &&
          !decl.prop.includes("stroke") ||
          !decl.value.includes("#") &&
          !decl.value.includes("rgb") &&
          !decl.value.includes("hsl");

      let isThemeColor = false;
      if (!isNotColorProp) {
          for (let i = 0; i < themeValues.length; i++) {
              isThemeColor = decl.value.includes(themeValues[i]);
              if (isThemeColor) {
                  break;
              }
          }
      }

      if (
          !isThemeColor
      ) {
        decl.remove();
      } else {
        removeRule = false;
      }
    });
    if (removeRule) {
      rule.remove();
    }
  };
  return css => {
    css.walkAtRules(atRule => {
      atRule.remove();
    });

    css.walkRules(cleanRule);

    css.walkComments(c => c.remove());
  };
});

function getMatches(string, regex) {
  const matches = {};
  let match;
  while ((match = regex.exec(string))) {
    if (match[2].startsWith("rgba") || match[2].startsWith("#")) {
      matches[`@${match[1]}`] = match[2];
    }
  }
  return matches;
}

/*
  This function takes less input as string and compiles into css.
*/
function render(text, paths) {
  return less.render.call(less, text, {
    paths: paths,
    javascriptEnabled: true,
    plugins: [new NpmImportPlugin({ prefix: '~' })]
  });
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
function getLessVars(filtPath) {
  const sheet = fs.readFileSync(filtPath).toString();
  const lessVars = {};
  const matches = sheet.match(/@(.*:[^;]*)/g) || [];

  matches.forEach(variable => {
    const definition = variable.split(/:\s*/);
    const varName = definition[0].replace(/['"]+/g, "").trim();
    lessVars[varName] = definition.splice(1).join(":");
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
  return 'color(~`colorPalette("@{' + className.replace('@', '') + '}", ' + number + ")`)";
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
  if (color.charAt(0) === "#") {
    color = color.substring(1);
    return (
      [3, 4, 6, 8].indexOf(color.length) > -1 && !isNaN(parseInt(color, 16))
    );
  }
  return /^(rgb|hsl)a?\((\d+%?(deg|rad|grad|turn)?[,\s]+){2,3}[\s\/]*[\d\.]+%?\)$/i.test(
    color
  );
}

function getCssModulesStyles(stylesDir) {
  const styles = glob.sync(path.join(stylesDir, './**/*.less'));
  return Promise.all(
    styles.map(p =>
      less
        .render(fs.readFileSync(p).toString(), {
          paths: [
            stylesDir,
          ],
          filename: path.resolve(p),
          javascriptEnabled: true,
          plugins: [new NpmImportPlugin({ prefix: '~' })],
        })
        .catch(() => '\n')
    )
  )
    .then(csss => csss.map(c => c.css).join('\n'))
    .catch(err => {
      console.log('Error', err);
      return '';
    });
}

/*
  This is main function which call all other functions to generate color.less file which contains all color
  related css rules based on your custom styles
  By default color.less will be generated in /public directory
*/
function generateTheme({
  stylesDir,
  mainLessFile,
  varFile,
  outputFilePath,
  themeVariables
}) {
  return new Promise((resolve, reject) => {
    /*
      You own custom styles (Change according to your project structure)
      
      - stylesDir - styles directory containing all less files
      - varFile - variable file containing your custom variables
      - mainLessFile - less main file which imports all styles
    */
    let content = '';
    const hashCode = hash.sha256().update(content).digest('hex');
    if(hashCode === hashCache){
      resolve(cssCache);
      return;
    }
    hashCache = hashCode;
    let themeCompiledVars = {};
    let themeVars = themeVariables || [];
    const lessPaths = [
      stylesDir
    ];

    return bundle({
      src: varFile
    })
      .then(colorsLess => {
        const mappings = Object.assign(generateColorMap(colorsLess), mainLessFile? generateColorMap(mainLessFile): {});
        return [mappings, colorsLess];
      })
      .then(([mappings, colorsLess]) => {
        let css = "";
        /*
         If not pass in themeVariables, the variables in varFile will be used
         */
        if (!themeVariables) {
            let varJs = lessToJs(fs.readFileSync(varFile, 'utf8'));
            themeVars.forEach(varName => {
                delete varJs[varName];
            });
            themeVars.push(...Object.keys(varJs));
        }
        if (!themeVars.length) {
            themeVars.push("@theme-color");
        }
        themeVars = themeVars.filter(name => name in mappings);
        themeVars.forEach(varName => {
          const color = mappings[varName];
          css = `.${varName.replace("@", "")} { color: ${color}; }\n ${css}`;
        });

        css = `${colorsLess}\n${css}`;
        return render(css, lessPaths).then(({ css }) => [
          css,
          mappings,
          colorsLess
        ]);
      })
      .then(([css, mappings, colorsLess]) => {
        css = css.replace(/(\/.*\/)/g, "");
        const regex = /.(?=\S*['-])([.a-zA-Z0-9'-]+)\ {\n\ \ color:\ (.*);/g;
        themeCompiledVars = getMatches(css, regex);
        content = `${content}\n${colorsLess}`;
        return render(content, lessPaths).then(({ css }) => {
          return getCssModulesStyles(stylesDir).then(customCss => {
            return [
              `${customCss}\n${css}`,
              mappings,
              colorsLess
            ];
          })
          
        });
      })
      .then(([css, mappings, colorsLess]) => {
        return postcss([reducePlugin(themeCompiledVars)])
          .process(css, {
            parser: less.parser,
            from: mainLessFile | varFile
          })
          .then(({ css }) => [css, mappings, colorsLess]);
      })
      .then(([css, mappings, colorsLess]) => {
        Object.keys(themeCompiledVars).forEach(varName => {
          let color;
          if (/(.*)-(\d)/.test(varName)) {
            color = themeCompiledVars[varName];
            varName = getShade(varName);
          } else {
            color = themeCompiledVars[varName];
          }
          color = color.replace('(', '\\(').replace(')', '\\)');
          css = css.replace(new RegExp(`${color}`, "g"), varName);
        });

        css = `${colorsLess}\n${css}`;

        themeVars.reverse().forEach(varName => {
          css = css.replace(new RegExp(`${varName}(\ *):(.*);`, 'g'), '');
          css = `${varName}: ${mappings[varName]};\n${css}\n`;
        });
        css = css.replace(/\n+/g, '\n');
        if (outputFilePath) {
          fs.writeFileSync(outputFilePath, css);
          console.log(
            `Theme generated successfully. OutputFile: ${outputFilePath}`
          );
        } else {
          console.log(`Theme generated successfully`);
        }
        cssCache = css;
        return resolve(css);
      })
      .catch(err => {
        console.log("Error", err);
        reject(err);
      });
  });
}

module.exports = {
  generateTheme,
  isValidColor,
  getLessVars,
  randomColor,
  renderLessContent: render
};
