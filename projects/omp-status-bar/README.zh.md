# omp-status-bar

[English](./README.md)

一个常驻的 OMP 状态栏：一个 `belowEditor` Widget Host 加六个内置 Provider，分别显示总 token、输入 token、缓存读取 token、输出 token、缓存命中率和上下文用量，并带投机压缩区间指示。

第三方扩展通过 `@ruokee/omp-status-bar/provider` 的公开合同添加 Provider。

## 文档

- [使用与配置](./docs/usage.zh.md)
- [Provider 合同](./docs/provider-contract.zh.md)
- [Provider 开发指南](./docs/provider-dev.zh.md)

## 安装

Package 尚未发布。检出 GitHub 仓库后，安装锁定版本的依赖，再把 Package 链接到用户级 OMP Plugin 目录：

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

按照[使用与配置](./docs/usage.zh.md)在当前 OMP agent 目录创建 `omp-status-bar.yml`，再启动新的 OMP 会话。Package 不会热加载配置修改。

### 更新

`omp plugin link` 注册的是这个检出目录，安装会一直从该目录加载 Package 及其依赖。请保留该目录，并在仓库根目录更新：

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-status-bar
bun install --frozen-lockfile
```

之后重启 OMP：运行中的进程会继续使用启动时加载的扩展代码，在同一进程中新建会话不会重新加载。

## 开发

```bash
bun install
bun run typecheck
bun test
```

运行时导入只限三个对等依赖：`@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-agent-core` 和 `@oh-my-pi/pi-tui`。

## 许可证

本组件使用 [MIT 许可证](./LICENSE)。
