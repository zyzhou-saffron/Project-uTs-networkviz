# Project-uTs-networkviz

基于 Three.js 的 3D 基因网络可视化项目，使用卡通风格渲染展示基因节点和连接关系。

## 技术栈

- **React 19** - 前端框架
- **TypeScript** - 类型安全
- **Three.js** - 3D 渲染引擎
- **Vite** - 构建工具
- **TailwindCSS v4** - 样式框架

## 功能特性

- 🎨 卡通风格 3D 网络图渲染
- 🔮 Fibonacci 球面分布算法
- ⚡ InstancedMesh 高效渲染 200+ 节点
- 🖱️ 交互式节点/边悬停高亮
- 🎯 多种布局模式切换
- 🎨 自定义颜色配置

## 本地运行

**前置要求:** Node.js >= 18

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动开发服务器:
   ```bash
   npm run dev
   ```

3. 打开浏览器访问 `http://localhost:5173`

## 生产构建

```bash
npm run build
npm run preview
```

## 项目结构

```
├── components/
│   └── GeneCanvas.tsx    # 核心 3D 渲染组件
├── App.tsx               # 主应用组件
├── index.tsx             # 入口文件
├── index.css             # TailwindCSS 样式
├── types.ts              # TypeScript 类型定义
├── tailwind.config.js    # TailwindCSS 配置
├── postcss.config.js     # PostCSS 配置
└── vite.config.ts        # Vite 配置
```

## License

MIT
