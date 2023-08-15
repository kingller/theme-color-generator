标签：
<font color=green>新增</font>
<font color=orange>修改</font>
<font color=blue>增强</font>
<font color=red>修复</font>
<font color=red><strong>删除</strong></font>


# Next


# 2.0.0
1. <font color=green>新增</font> `globalVarFile` 配置 `less` 变量文件路径，文件中的 `less` 变量会从所有less文件中把对应css变量替换成less变量
2. <font color=green>新增</font> `globalVarFileThemeRegex` 配置正则表达式匹配出 `globalVarFile` 文件中与主题色相关的变量。大多数情况下不需要使用。
3. <font color=orange>修改</font> 包升级
```
clean-css               5.2.2   =>  5.3.2
glob                    7.2.0   =>  10.3.3
hash.js                 1.1.5   =>  1.1.7
less                    4.1.2   =>  4.2.0
postcss                 8.4.5   =>  8.4.27
```


# 1.5.0
1. <font color=orange>修改</font> 包升级
```
clean-css               4.2.1   =>  5.2.2
glob                    7.1.3   =>  7.2.0
less                    3.8.1   =>  4.1.2
less-bundle-promise     1.0.7   =>  1.0.11
postcss                 7.0.5   =>  8.4.5
```


# 1.4.0
1. <font color=green>新增</font> `themeReplacement`参数，支持生成时替换变量文件`varFile`中参数的值


# 1.3.2
1. <font color=blue>增强</font> 优化从`outputFilePath`获取输出文件路径，避免执行出错


# 1.3.1
1. <font color=red>修复</font> 输出主题色文件时判断路径是否存在，如不存在则创建该路径


# 1.3.0
1. <font color=green>新增</font> `include`指定包含文件
2. <font color=green>新增</font> `options`设置`less`参数

# 1.2.2
1. <font color=green>修改</font> `README.md`

# 1.2.1
1. <font color=green>新增</font> Online Demo

# 1.2.0
1. <font color=blue>增强</font> 去除重复样式