var fs = require('fs');
var path = require('path');
var Components = require('../../components.json');
var render = require('json-templater/string');
var endOfLine = require('os').EOL;

function mergeTemplate(importName, path, exportName) {

  var index = importNameList.indexOf(importName);

  if (index > -1) {
    includeComponentTemplate.splice(index, 1);
  }

  includeComponentTemplate.push(render(IMPORT_TEMPLATE, {
    name: importName,
    path: path
  }));
  // 如果是自定Shaders或者是源码中的Shaders, 装入Shaders数组, 负责正常装入导出模块
  if (/^\'(cesium|source){1}\/Shaders\/.*/.test(path)) {
    var isExist = shadersListTemplate.indexOf(importName);
    if (isExist > -1) {
      shadersListTemplate.splice(index, 1, importName);
    } else {
      shadersListTemplate.push(render(SHADERS_TEMPLATE, {
        name: importName
      }));
    }
  } else {
    listTemplate.push(render(EXPORT_TEMPLATE, {
      importName: importName,
      exportName: exportName
    }));
  }
}

var IMPORT_TEMPLATE = 'import {{name}} from {{path}};';
var EXPORT_TEMPLATE = '{{exportName}}: {{importName}}';
var OUTPUT_PATH = path.join(__dirname, '../../src/index.js');
var SHADERS_TEMPLATE = '{{name}}';
var MAIN_TEMPLATE = `/* Automatically generated by './build/bin/build-entry.js' */
import 'cesium/Widgets/widgets.css';
{{include}}

const _shaders = {
  {{_shaders}}
};

module.exports = {
  version: '{{version}}',
  _shaders: _shaders,
  {{list}}
};

module.exports.default = module.exports;
`;

// 获取源代码字符串
var source = fs.readFileSync(path.join(__dirname, '../../node_modules/cesium/Source/Cesium.js')).toString();
// 获取导入名称
var importNameList = /function\((.*)\)/.exec(source)[1].split(', ');
// 获取导出路径
var pathList = /define\(\[(.+)\]/g.exec(source.toString())[1].replace(/\'\./g, '\'cesium').split(', ');

// 获取导出名称
var exportNameList = pathList.map(path => {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\./g, '_').replace(/\-/g, '_').replace(/\'/g, '');
});

if (importNameList.length !== exportNameList.length || exportNameList.length !== pathList.length) {
  console.log('没有正确匹配导入,导出与路径');
}

var mergeArray = [];
var includeComponentTemplate = [];
var shadersListTemplate = [];
var listTemplate = [];
var ComponentNames = Object.keys(Components);

importNameList.forEach((name, index) => {
  mergeArray.push({
    importName: name,
    exportName: exportNameList[index],
    path: pathList[index]
  });
});

mergeArray.forEach(obj => {
  const importName = obj.importName;
  const exportName = obj.exportName;
  var path = obj.path;

  let index = ComponentNames.indexOf(obj.exportName);
  if (index > -1) {
    path = Components[exportName];
    delete Components[exportName];
    ComponentNames.splice(index, 1);
  }

  mergeTemplate(importName, path, exportName);
});

ComponentNames.forEach(com => {
  var path = Components[com];

  var importName = path.replace(/\'/g, '').replace(/^source\//, '').replace(/[\.\-]/g, '_').split('\/').join('_');
  var exportName = com;

  mergeTemplate(importName, path, exportName);
});

var template = render(MAIN_TEMPLATE, {
  include: includeComponentTemplate.join(endOfLine),
  version: process.env.VERSION || require('../../package.json').version,
  _shaders: shadersListTemplate.join(',' + endOfLine + '  '),
  list: listTemplate.join(',' + endOfLine + '  ')
});

fs.writeFileSync(OUTPUT_PATH, template);

console.log('[build entry] DONE:', OUTPUT_PATH);