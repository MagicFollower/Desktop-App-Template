# CORS 跨域技术报告（双视角深度分析）

> **文档类型**：双视角技术分析文档
> **读者定位**：前端开发团队成员（含零基础新人），兼顾需要配合的后端同学
> **编写视角**：资深全栈工程师
> **分析路径**：前端视角 → 后端（Java / Spring Boot）视角
> **目标**：从零基础到完整掌握 CORS 的概念、原理、细节与多场景落地

---

## 目录

- [前言：为什么要读这篇文档](#前言为什么要读这篇文档)
- [第一部分：前端视角的技术分析](#第一部分前端视角的技术分析)
- [第二部分：后端视角的技术分析（Java / Spring Boot）](#第二部分后端视角的技术分析java--spring-boot)
- [第三部分：多场景落地实战](#第三部分多场景落地实战)
- [附录：速查表与常见误区](#附录速查表与常见误区)

---

# 前言：为什么要读这篇文档

跨域（CORS）是前后端分离开发中**最频繁遇到的问题之一**。几乎每个前端新人都见过这个报错：

```
Access to XMLHttpRequest at 'http://api.example.com/data'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

但大多数人只是"照着网上的方法改一改配置"，并没有真正理解它。**这篇文档的目的，是让你从"会改配置"进阶到"真正理解"**。

我们采用**双视角**的方式来讲解：
1. **前端视角**：浏览器是怎么发起跨域请求的？它期望什么？
2. **后端视角**：服务端要怎么响应，才能满足浏览器的要求？

只有同时理解两边，你才能在不同场景下做出正确的决策，而不是盲目复制配置。

> **新人小结**
>
> 读这篇文档时，请记住一个核心比喻：**CORS 就像"跨国寄快递"**。
> - 你的国家（前端页面）想把包裹（请求）寄到另一个国家（后端服务）
> - 但海关（浏览器）有规定：必须先确认"对方国家同意接收"，才放行
> - CORS 协议就是两国之间的"通关协议"，规定了要出示哪些凭证（请求头 / 响应头）
>
> 带着这个比喻往下读，会容易理解很多。

---

# 第一部分：前端视角的技术分析

这一部分完全站在前端和浏览器的角度，理解跨域问题的来龙去脉。

## 1.1 一切始于同源策略（Same-Origin Policy）

要理解 CORS，必须先理解它的"对立面"——**同源策略**。

**同源策略**是浏览器的一个核心安全机制：它限制了一个源（origin）的脚本，只能访问**同源**的资源。

**什么是"源"？** 源由三部分组成：

```
协议 + 域名 + 端口

例如：
https://www.example.com:443
  │        │           │
协议     域名        端口
```

**只有这三者完全相同，才算同源**：

| URL A | URL B | 是否同源 | 原因 |
|-------|-------|---------|------|
| `http://a.com/page1` | `http://a.com/page2` | ✅ 同源 | 协议、域名、端口都相同 |
| `http://a.com` | `https://a.com` | ❌ 不同源 | 协议不同 |
| `http://a.com` | `http://b.com` | ❌ 不同源 | 域名不同 |
| `http://a.com` | `http://a.com:8080` | ❌ 不同源 | 端口不同 |
| `http://a.com` | `http://sub.a.com` | ❌ 不同源 | 域名不同（子域名也算不同） |

> **新人小结**
>
> 同源策略是**浏览器**的安全机制，不是服务器或 HTTP 协议本身的限制。这一点极其重要——它意味着：
> 1. 你用 Postman、curl 直接请求接口，**不会有跨域问题**（因为它们不是浏览器，不受同源策略约束）
> 2. 跨域报错是浏览器"拦截"了响应，而不是服务器拒绝了请求
>
> 理解这一点，能帮你避免一个常见误区：以为"服务器配置错了导致跨域失败"，其实很多时候是前端请求方式的问题。

## 1.2 同源策略保护了什么

为什么浏览器要有同源策略？它防止的是**恶意网站的脚本，随意访问其他网站的敏感数据**。

**一个典型的攻击场景**：

```
1. 你登录了银行网站 bank.com，浏览器保存了登录 Cookie
2. 你打开了一个恶意网站 evil.com
3. evil.com 的 JavaScript 代码尝试：
   fetch('https://bank.com/api/transfer?to=hacker&amount=10000')
4. 如果没有同源策略，这个请求会自动带上你在 bank.com 的 Cookie
   → 你的钱就被转走了！
5. 有了同源策略，浏览器拦截这个请求
   → 攻击失败
```

所以，同源策略的本质是**保护用户数据安全**。它默认假设"不同源的脚本是不可信的"。

> **新人小结**
>
> 同源策略不是"缺陷"，而是"保护"。当你遇到跨域报错时，不要想着"怎么绕过它"，而要想着"怎么正确地声明两个源之间的信任关系"。CORS 就是那个"声明信任"的标准机制。

## 1.3 跨域问题的本质

理解了同源策略，跨域问题就清楚了：

**跨域问题的本质**：前端页面（源 A）想通过 JavaScript 请求后端接口（源 B），但 A 和 B 不同源，浏览器默认拦截。

在前后端分离架构中，这几乎必然发生：

```
前端开发服务器：  http://localhost:5173  (Vite)
后端 API 服务：   http://localhost:8080  (Spring Boot)

端口不同 → 不同源 → 跨域！
```

**关键认知**：跨域不是"请求发不出去"，而是"响应被浏览器拦截"。请求实际上已经到达服务器，服务器也返回了数据，只是浏览器不让前端 JavaScript 读取这个数据。

## 1.4 CORS 是什么

**CORS**（Cross-Origin Resource Sharing，跨源资源共享）是一个 **W3C 标准**，它定义了一套 HTTP 头，让浏览器和服务器能够"协商"：这个跨域请求是否被允许。

**CORS 的工作方式**：
1. 浏览器检测到跨域请求
2. 浏览器自动在请求中添加特定的**请求头**（如 `Origin`）
3. 服务器返回带有特定**响应头**（如 `Access-Control-Allow-Origin`）
4. 浏览器检查响应头，决定是否允许前端读取响应

**核心思想**：跨域的控制权在**服务器**。服务器通过响应头声明"我允许哪些源访问我"，浏览器据此放行或拦截。

> **新人小结**
>
> 记住这个关键结论：**跨域问题最终要靠后端（服务器）来解决**。前端能做的只是"正确地发起请求"和"在开发环境用代理临时规避"。真正的、生产可用的跨域方案，一定是在服务端配置允许的源。这是理解整个 CORS 的基石。

## 1.5 简单请求与预检请求

这是 CORS 中最核心、也最容易混淆的概念。浏览器把跨域请求分成两类：

### 简单请求（Simple Request）

满足**所有**以下条件的请求，是简单请求：

1. **方法是这三种之一**：`GET`、`HEAD`、`POST`
2. **请求头只包含**这些"安全"的头：
   - `Accept`、`Accept-Language`、`Content-Language`
   - `Content-Type`（但值只能是 `application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain`）
3. 没有使用 `ReadableStream`

**简单请求的流程**：浏览器直接发送请求，同时带上 `Origin` 头，然后根据响应头判断是否允许。

```
浏览器                          服务器
  │                                │
  │── GET /data ──────────────────▶│
  │   Origin: http://localhost:5173│
  │                                │
  │◀── 200 OK ─────────────────────│
  │   Access-Control-Allow-Origin: │
  │     http://localhost:5173      │
  │                                │
浏览器检查响应头 → 允许前端读取
```

### 预检请求（Preflight Request）

不满足简单请求条件的，会触发**预检请求**。比如：
- 使用了 `PUT`、`DELETE` 方法
- `Content-Type` 是 `application/json`
- 带了自定义头（如 `Authorization`）

**预检请求的流程**：浏览器先发送一个 `OPTIONS` 请求"探路"，询问服务器是否允许，得到肯定答复后才发送真正的请求。

```
浏览器                          服务器
  │                                │
  │ 第 1 步：预检请求                │
  │── OPTIONS /data ──────────────▶│
  │   Origin: http://localhost:5173│
  │   Access-Control-Request-Method: PUT
  │   Access-Control-Request-Headers: Content-Type
  │                                │
  │◀── 204 No Content ─────────────│
  │   Access-Control-Allow-Origin: │
  │     http://localhost:5173      │
  │   Access-Control-Allow-Methods:│
  │     GET, POST, PUT             │
  │   Access-Control-Allow-Headers:│
  │     Content-Type               │
  │                                │
  │ 第 2 步：预检通过，发送真实请求    │
  │── PUT /data ──────────────────▶│
  │   Origin: http://localhost:5173│
  │                                │
  │◀── 200 OK ─────────────────────│
  │   Access-Control-Allow-Origin: │
  │     http://localhost:5173      │
  │                                │
浏览器检查响应头 → 允许前端读取
```

> **新人小结**
>
> 为什么 `application/json` 会触发预检，而 `text/plain` 不会？这是历史原因：早期的表单提交只能发 `text/plain` 等几种类型，所以这些被认为是"传统且安全"的。而 `application/json` 是 AJAX 时代才广泛用于跨域的，浏览器对它更谨慎，要求先预检。
>
> **实用判断**：如果你的接口用 `Content-Type: application/json`（绝大多数 REST API 都是），那它**一定是预检请求**。调试跨域时，记得在 Network 面板找那个 `OPTIONS` 请求。

## 1.6 关键的请求头（浏览器自动添加）

跨域请求中，浏览器会自动添加这些请求头，前端开发者通常**不需要手动设置**：

| 请求头 | 出现场景 | 含义 |
|--------|---------|------|
| `Origin` | 所有跨域请求 | 标明请求来自哪个源 |
| `Access-Control-Request-Method` | 预检请求 | 告诉服务器真实请求要用什么方法 |
| `Access-Control-Request-Headers` | 预检请求 | 告诉服务器真实请求要带哪些自定义头 |

**示例**：
```
Origin: http://localhost:5173
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization
```

> **新人小结**
>
> 很多新人会尝试手动设置 `Origin` 头来解决跨域——这是无效的。浏览器会忽略你手动设置的 `Origin`，自动用真实的源覆盖它。跨域不是靠"改请求头"解决的，而是靠"服务器返回正确的响应头"。

## 1.7 关键的响应头（服务器返回）

这是 CORS 的**核心**——服务器通过这些响应头声明跨域策略：

| 响应头 | 含义 | 示例 |
|--------|------|------|
| `Access-Control-Allow-Origin` | 允许哪些源访问 | `http://localhost:5173` 或 `*` |
| `Access-Control-Allow-Methods` | 允许哪些 HTTP 方法 | `GET, POST, PUT, DELETE` |
| `Access-Control-Allow-Headers` | 允许哪些自定义请求头 | `Content-Type, Authorization` |
| `Access-Control-Allow-Credentials` | 是否允许携带 Cookie | `true` |
| `Access-Control-Max-Age` | 预检结果缓存时间（秒） | `86400` |
| `Access-Control-Expose-Headers` | 允许前端读取哪些响应头 | `X-Total-Count` |

**最关键的三个**：

1. **`Access-Control-Allow-Origin`**：必须匹配请求的 `Origin`，否则跨域失败
2. **`Access-Control-Allow-Credentials`**：如果请求带 Cookie，必须设为 `true`
3. **`Access-Control-Allow-Headers`**：如果请求带自定义头（如 `Authorization`），必须在这里列出

## 1.8 携带 Cookie 的特殊规则

这是 CORS 中**最容易踩坑**的部分。

默认情况下，跨域请求**不会携带 Cookie**。要携带，前端需要设置：

```javascript
// fetch
fetch('http://api.example.com/data', {
  credentials: 'include'  // 携带 Cookie
});

// axios
axios.get('http://api.example.com/data', {
  withCredentials: true  // 携带 Cookie
});
```

但**仅仅前端设置还不够**，后端必须同时满足两个条件：

1. `Access-Control-Allow-Credentials: true`
2. `Access-Control-Allow-Origin` **不能是 `*`**，必须是具体的源

```
✅ 正确：
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true

❌ 错误（会跨域失败）：
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

> **新人小结**
>
> 为什么带 Cookie 时不能用 `*`？因为 Cookie 包含敏感的身份信息。如果允许 `*`（任意源）+ 携带 Cookie，那任何网站都能带着你的 Cookie 访问接口，等于完全破坏了安全防护。所以浏览器强制要求：**带凭证的跨域，必须明确指定源**。这是安全设计的体现。

## 1.9 前端开发环境的跨域解决方案

开发阶段，前端最常用的规避跨域手段是**代理**。

### Vite 代理（我们项目的方式）

在 `vite.config.ts` 中配置：

```typescript
export default defineConfig({
  server: {
    proxy: {
      // 所有以 /api 开头的请求，代理到后端
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,  // 修改 Origin 头
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
});
```

**原理**：
- 前端代码请求 `/api/data`（同源，没有跨域问题）
- Vite 开发服务器把请求转发给 `http://localhost:8080/data`
- 因为转发是服务器端行为，不受同源策略限制

```
浏览器 ──/api/data──▶ Vite服务器 ──/data──▶ Spring Boot
         (同源)        (代理转发)     (服务器间通信，无跨域)
```

> **新人小结**
>
> **重要提醒**：代理只在**开发环境**有效。因为代理依赖开发服务器（Vite）存在。生产环境中，打包后的静态文件没有开发服务器，代理配置不会生效。所以生产环境的跨域，还是要靠后端配置或 Nginx 反向代理。很多新人"开发环境没问题、上线就跨域报错"，就是因为误以为代理能解决生产问题。

## 1.10 前端常见跨域报错与排查

| 报错信息 | 原因 | 解决方向 |
|---------|------|---------|
| `No 'Access-Control-Allow-Origin' header` | 后端没配置允许源 | 后端配置 `Allow-Origin` |
| `The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when credentials mode is 'include'` | 带 Cookie 但用了 `*` | 后端改为具体源 |
| `Request header field xxx is not allowed by Access-Control-Allow-Headers` | 自定义头未被允许 | 后端在 `Allow-Headers` 中加上 |
| `Method xxx is not allowed by Access-Control-Allow-Methods` | 方法未被允许 | 后端在 `Allow-Methods` 中加上 |
| 预检请求 `OPTIONS` 返回 404/403 | 后端没处理 OPTIONS | 后端放行 OPTIONS 请求 |

**排查思路**（按顺序）：
1. 打开 DevTools → Network 面板
2. 找到出错的请求，看是否有对应的 `OPTIONS` 预检请求
3. 检查预检请求的响应头是否包含所需的 `Allow-*` 头
4. 检查真实请求的响应头

---

# 第二部分：后端视角的技术分析（Java / Spring Boot）

这一部分切换到后端视角，看 Spring Boot 如何配置 CORS，以及背后的原理。

## 2.1 Spring Boot 处理 CORS 的整体思路

Spring Boot 处理 CORS 的核心是：**拦截请求，检查 `Origin` 头，如果匹配配置则添加 `Access-Control-Allow-*` 响应头**。

Spring 提供了多种配置方式，从"针对单个接口"到"全局配置"，粒度由细到粗：

| 方式 | 粒度 | 适用场景 |
|------|------|---------|
| `@CrossOrigin` 注解 | 单个方法 / 控制器 | 少量接口需要跨域 |
| `WebMvcConfigurer.addCorsMappings` | 全局（按路径） | 大多数接口需要跨域 |
| `CorsFilter` / `CorsConfigurationSource` | 全局（过滤器） | 需要精细控制、配合 Security |

> **新人小结**
>
> 选择哪种方式，取决于你的需求：
> - 只有个别接口跨域 → 用 `@CrossOrigin`
> - 整个项目都要跨域 → 用全局配置
> - 用了 Spring Security → 推荐用 `CorsConfigurationSource`（原因见 2.5）

## 2.2 方式一：@CrossOrigin 注解

最简单的做法，在控制器方法或类上加注解：

```java
@RestController
@RequestMapping("/api")
public class UserController {

    // 方法级：只允许这个接口跨域
    @CrossOrigin(origins = "http://localhost:5173")
    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();
    }
}
```

**类级别**（对该控制器所有方法生效）：
```java
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RestController
@RequestMapping("/api")
public class UserController {
    // ...
}
```

**常用属性**：
```java
@CrossOrigin(
    origins = {"http://localhost:5173", "https://prod.example.com"},  // 允许的源
    methods = {RequestMethod.GET, RequestMethod.POST},                // 允许的方法
    allowedHeaders = {"Content-Type", "Authorization"},               // 允许的头
    allowCredentials = "true",                                        // 允许 Cookie
    maxAge = 3600                                                     // 预检缓存 1 小时
)
```

> **新人小结**
>
> `@CrossOrigin` 很方便，但有个隐患：如果接口很多，每个都加注解容易遗漏，而且配置分散、难以统一维护。所以对于"整个项目都要跨域"的场景，更推荐全局配置。

## 2.3 方式二：全局配置（WebMvcConfigurer）

实现 `WebMvcConfigurer` 接口，统一配置所有路径的跨域：

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")                    // 所有路径
                .allowedOrigins("http://localhost:5173")  // 允许的源
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")                  // 允许所有头
                .allowCredentials(true)               // 允许 Cookie
                .maxAge(3600);                        // 预检缓存
    }
}
```

**注意**：当 `allowCredentials(true)` 时，`allowedOrigins` **不能用 `*`**，必须指定具体源。如果要允许多个源，用 `allowedOriginPatterns`：

```java
registry.addMapping("/**")
        .allowedOriginPatterns("*")   // 允许任意源（配合 credentials）
        .allowCredentials(true);
```

> **新人小结**
>
> `allowedOrigins("*")` 和 `allowedOriginPatterns("*")` 的区别：
> - `allowedOrigins("*")`：严格的通配符，但**不能和 `allowCredentials(true)` 一起用**
> - `allowedOriginPatterns("*")`：模式匹配，**可以和 `allowCredentials(true)` 一起用**，它会把实际的 `Origin` 回填到响应头
>
> 如果你需要"允许任意源 + 携带 Cookie"，必须用 `allowedOriginPatterns`。这是 Spring 5.3+ 引入的，专门为了解决这个矛盾。

## 2.4 方式三：CorsFilter（过滤器）

通过注册一个 `CorsFilter` Bean，在过滤器层面处理跨域：

```java
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOriginPattern("*");       // 允许的源
        config.addAllowedHeader("*");              // 允许的头
        config.addAllowedMethod("*");              // 允许的方法
        config.setAllowCredentials(true);          // 允许 Cookie
        config.setMaxAge(3600L);                   // 预检缓存

        UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
```

**这种方式的优势**：它在 Servlet 过滤器层面工作，**执行时机比控制器更早**，因此对 Spring Security 等更兼容。

## 2.5 Spring Security 与 CORS 的坑

如果你用了 Spring Security，跨域配置会变得更复杂。

**问题**：Spring Security 的过滤器链**优先级很高**，会在你的 `WebMvcConfigurer` 配置之前拦截请求。如果预检请求（`OPTIONS`）被 Security 拦截（比如要求认证），跨域就会失败。

**正确做法**：在 Security 配置中显式启用 CORS：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())  // 启用 CORS
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .anyRequest().authenticated()
            );
        return http.build();
    }

    // 提供 CORS 配置源
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(Arrays.asList("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

**关键点**：
1. `.cors(Customizer.withDefaults())` 让 Security 启用 CORS 支持
2. `corsConfigurationSource()` Bean 提供具体配置
3. 这样预检请求（OPTIONS）会被正确放行

> **新人小结**
>
> 如果你的项目用了 Spring Security，但跨域一直失败，99% 的原因是没有在 Security 里启用 CORS。`WebMvcConfigurer` 的配置会被 Security 的过滤器"拦在前面"而失效。**记住：用了 Security，就用 `corsConfigurationSource()` + `.cors()`，别用 `addCorsMappings`**。

## 2.6 预检请求（OPTIONS）的处理

预检请求是 `OPTIONS` 方法，后端必须正确处理它。

**问题场景**：如果你的全局拦截器、过滤器或 Security 配置要求"所有请求都要认证"，那 `OPTIONS` 预检请求也会被要求认证，导致预检失败，进而真实请求也失败。

**解决方案**：放行 `OPTIONS` 请求。

在自定义拦截器中：
```java
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        // 放行预检请求
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // 其他认证逻辑...
    }
}
```

在 Security 中：
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()  // 放行 OPTIONS
    .anyRequest().authenticated()
)
```

## 2.7 网关层的 CORS 配置

在微服务架构中，通常在**网关**（如 Spring Cloud Gateway）统一处理跨域，而不是每个服务单独配置。

**Spring Cloud Gateway 配置**：
```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOriginPatterns: "*"
            allowedMethods: "*"
            allowedHeaders: "*"
            allowCredentials: true
```

**好处**：
- 统一配置，避免每个服务重复
- 所有请求都经过网关，跨域策略一致

> **新人小结**
>
> 如果用了网关，**不要在网关和后端服务同时配置 CORS**。否则可能出现响应头重复（比如两个 `Access-Control-Allow-Origin`），浏览器会报错。跨域配置应该**只在一层**——要么网关，要么服务，二选一。

## 2.8 动态允许的 Origin

有时你需要根据请求的 `Origin` 动态决定是否允许（比如允许多个子域名）。

**方式一：`allowedOriginPatterns`**
```java
config.setAllowedOriginPatterns(Arrays.asList(
    "https://*.example.com",      // 所有 example.com 的子域名
    "http://localhost:*"          // 本地任意端口
));
```

**方式二：自定义逻辑**（通过 `CorsConfiguration` 的子类或过滤器手动处理）：
```java
@Bean
public CorsFilter corsFilter() {
    return new CorsFilter(request -> {
        String origin = request.getHeader("Origin");
        // 自定义判断逻辑
        if (origin != null && origin.endsWith(".example.com")) {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(Arrays.asList(origin));
            config.setAllowedMethods(Arrays.asList("*"));
            config.setAllowCredentials(true);
            return config;
        }
        return null;  // 不允许
    });
}
```

## 2.9 后端常见跨域问题与排查

| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 预检请求 403 | Security 拦截了 OPTIONS | 在 Security 中启用 CORS 并放行 OPTIONS |
| 响应头重复 | 网关和服务都配了 CORS | 只在一层配置 |
| 带 Cookie 失败 | `Allow-Origin` 是 `*` | 改为具体源或用 `allowedOriginPatterns` |
| 配置了但不生效 | 用了 Security 但配的是 `addCorsMappings` | 改用 `corsConfigurationSource` |
| 生产环境跨域 | 以为开发代理能生效 | 生产靠后端或 Nginx 配置 |

## 2.10 后端视角的最佳实践

1. **统一配置**：优先用全局配置，避免散落的注解
2. **收紧源**：生产环境不要用 `*`，明确列出允许的域名
3. **配合 Security**：用了 Security 就用 `.cors()` + `corsConfigurationSource()`
4. **放行 OPTIONS**：确保预检请求不被认证逻辑拦截
5. **单点配置**：有网关时只在网关配，避免重复
6. **预检缓存**：设置 `maxAge`，减少 OPTIONS 请求次数

---

# 第三部分：多场景落地实战

这一部分把前两部分的理论，落到具体的真实场景中。

## 3.1 场景一：开发环境前后端分离

**情况**：前端 `http://localhost:5173`（Vite），后端 `http://localhost:8080`。

**推荐方案**：前端用 Vite 代理（开发环境最简单）。

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
});
```

前端代码请求 `/api/xxx`，自动代理到后端。**开发环境无需后端配置 CORS**。

> **新人小结**
>
> 这是前后端分离开发的**标准做法**。前端用代理规避跨域，后端专注业务逻辑。但记住：这只是开发环境的便利，生产环境要另行处理。

## 3.2 场景二：生产环境同域部署

**情况**：前端打包后的静态文件和后端部署在**同一个域名和端口**下。

```
前端：  https://www.example.com/           (静态文件)
后端：  https://www.example.com/api/       (接口)
```

**结论**：**没有跨域问题**！因为同源（协议、域名、端口都相同）。

**实现方式**：用 Nginx 把静态文件和 API 都挂在同一域名下：

```nginx
server {
    listen 443 ssl;
    server_name www.example.com;

    # 前端静态文件
    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8080/;
    }
}
```

> **新人小结**
>
> **这是生产环境最推荐的方案**。同域部署从根本上消除了跨域问题，不需要任何 CORS 配置，也最安全。如果你的部署条件允许，优先选择这种方式。

## 3.3 场景三：生产环境跨域部署（Nginx 反向代理）

**情况**：前端和后端不同域，但你控制 Nginx。

```
前端：  https://www.example.com      (静态文件)
后端：  https://api.example.com      (接口)
```

**方案 A：Nginx 反向代理（推荐）**——把后端接口也通过前端域名的 Nginx 转发，变成"同域"：

```nginx
server {
    server_name www.example.com;

    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }

    # 把 /api 转发到后端，前端请求 www.example.com/api 即同源
    location /api/ {
        proxy_pass http://backend-server:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**方案 B：Nginx 直接添加 CORS 头**（如果无法做反向代理）：

```nginx
server {
    server_name api.example.com;

    location / {
        # 处理预检请求
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://www.example.com';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
            add_header 'Access-Control-Allow-Credentials' 'true';
            add_header 'Access-Control-Max-Age' 1728000;
            return 204;
        }

        # 真实请求也要加响应头
        add_header 'Access-Control-Allow-Origin' 'https://www.example.com' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        proxy_pass http://localhost:8080;
    }
}
```

> **新人小结**
>
> 方案 A（反向代理）优于方案 B（加 CORS 头）。因为反向代理让请求变成"同域"，彻底绕开跨域，更简单也更安全。只有在"前后端域名必须分开、且无法统一入口"时才用方案 B。

## 3.4 场景四：微服务网关统一处理

**情况**：多个后端微服务，前端通过网关访问。

**方案**：在网关层统一配置 CORS（见 2.7），后端服务不配置。

```
前端 ──▶ 网关（配置 CORS）──▶ 服务A / 服务B / 服务C
```

**优点**：配置集中、策略统一、避免重复。

## 3.5 场景五：调用第三方 API

**情况**：你的前端要调用别人的公开 API（如天气、地图），对方可能没配你域名的 CORS。

**你能做的**：
- **看对方文档**：很多公共 API 支持 `Access-Control-Allow-Origin: *`
- **用自己的后端中转**：前端请求自己的后端，后端再去调第三方（服务器间无跨域）

```
前端 ──▶ 自己的后端（同域/已配 CORS）──▶ 第三方 API
                                         (服务器间，无跨域限制)
```

> **新人小结**
>
> 调用第三方 API 遇到跨域，你**无法修改对方的服务器配置**。所以最可靠的办法是"用自己的后端做中转"。这也是为什么很多"免费 API"在前端直接调不通，但放到后端就通了。

## 3.6 场景六：文件上传跨域

**情况**：前端上传文件到对象存储（如阿里云 OSS、AWS S3），通常是跨域的。

**方案**：对象存储服务都支持配置 CORS 规则，在它们的控制台配置：
- 允许的来源（你的前端域名）
- 允许的方法（`PUT`、`POST`）
- 允许的头（`Content-Type` 等）

**注意**：文件上传常用 `multipart/form-data`，这是"简单请求"的 Content-Type，但上传往往带自定义头，所以仍可能触发预检。

## 3.7 场景七：WebSocket 跨域

**情况**：前端用 WebSocket 连接不同源的服务。

**关键认知**：WebSocket **不受同源策略限制**（它不是基于同源策略设计的），但服务端可以检查 `Origin` 头来决定是否接受连接。

```javascript
const ws = new WebSocket('wss://api.example.com/ws');
```

服务端（Spring）可以校验 `Origin`：
```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(myHandler(), "/ws")
                .setAllowedOrigins("https://www.example.com");  // 允许的源
    }
}
```

## 3.8 场景八：携带 Cookie 的完整链路

**情况**：跨域请求需要携带登录 Cookie（如 Session 认证）。

**前端**：
```javascript
axios.defaults.withCredentials = true;
// 或
fetch(url, { credentials: 'include' });
```

**后端**（必须同时满足）：
```java
config.setAllowedOriginPatterns(Arrays.asList("https://www.example.com"));
config.setAllowCredentials(true);
// 注意：不能用 setAllowedOrigins("*")
```

**Cookie 本身**：
- 设置 Cookie 时要指定 `SameSite`、`Secure`、`Domain` 属性
- 跨站携带 Cookie 通常需要 `SameSite=None; Secure`

```java
response.addHeader("Set-Cookie",
    "sessionId=abc; Path=/; Domain=.example.com; Secure; SameSite=None");
```

> **新人小结**
>
> 携带 Cookie 的跨域是**最复杂**的场景，涉及前端、后端、Cookie 属性三方面配合。如果可能，优先考虑用 Token（放在 `Authorization` 头）代替 Cookie 做认证，能完全绕开这个复杂性。现代前后端分离项目更推荐 JWT + Authorization 头的方案。

## 3.9 场景九：预检请求优化

**情况**：预检请求增加了额外的网络往返，频繁触发会影响性能。

**优化手段**：

1. **设置 `maxAge` 缓存预检结果**：
```
Access-Control-Max-Age: 86400   // 缓存 24 小时
```
在缓存期内，同样的跨域请求不再触发预检。

2. **尽量用"简单请求"**：如果接口设计允许，用 `GET`/`POST` + 表单格式，避免预检。但这通常不现实（REST API 多用 JSON）。

3. **合并自定义头**：减少 `Access-Control-Request-Headers` 中的头数量。

> **新人小结**
>
> `maxAge` 是最实用的优化。设置后，浏览器会缓存预检结果，后续相同请求直接跳过 OPTIONS。生产环境建议设置为几小时到一天，能显著减少 OPTIONS 请求。

## 3.10 场景十：完整配置清单（Checklist）

把前面所有内容浓缩成一个上线前的检查清单：

**前端检查**：
- [ ] 开发环境：配置了 Vite 代理
- [ ] 请求库：需要 Cookie 时设置了 `withCredentials: true`
- [ ] 生产环境：请求的是同域或已处理跨域的地址

**后端检查**：
- [ ] 选择了一种 CORS 配置方式（注解 / 全局 / 过滤器）
- [ ] 若用 Security：配置了 `.cors()` + `corsConfigurationSource()`
- [ ] 放行了 OPTIONS 预检请求
- [ ] 带 Cookie 时：源不是 `*`，用了具体源或 `allowedOriginPatterns`
- [ ] 设置了 `maxAge` 优化预检
- [ ] 生产环境收紧了允许的源（不用 `*`）

**部署检查**：
- [ ] 优先同域部署，消除跨域
- [ ] 若跨域：只在网关或后端一处配置，避免响应头重复
- [ ] Nginx 配置正确（如用方案 B）

---

# 附录：速查表与常见误区

## CORS 响应头速查表

| 响应头 | 作用 | 必需场景 |
|--------|------|---------|
| `Access-Control-Allow-Origin` | 允许的源 | **所有跨域**（必需） |
| `Access-Control-Allow-Methods` | 允许的方法 | 预检请求 |
| `Access-Control-Allow-Headers` | 允许的头 | 有自定义头时 |
| `Access-Control-Allow-Credentials` | 允许 Cookie | 带 Cookie 时 |
| `Access-Control-Max-Age` | 预检缓存 | 性能优化 |
| `Access-Control-Expose-Headers` | 暴露响应头给前端 | 前端要读自定义响应头时 |

## 简单请求判定速查

满足**全部**条件才是简单请求：
- 方法：`GET` / `HEAD` / `POST`
- Content-Type：`text/plain` / `multipart/form-data` / `application/x-www-form-urlencoded`
- 无自定义头

**否则 → 预检请求**（先发 OPTIONS）

## 十大常见误区

1. ❌ **"跨域是服务器拒绝了请求"** → 请求其实到达了服务器，是浏览器拦截了响应
2. ❌ **"Postman 能调通，说明后端没问题"** → Postman 不受同源策略限制，不能用来验证跨域
3. ❌ **"手动设置 Origin 头能解决跨域"** → 浏览器会忽略手动设置的 Origin
4. ❌ **"开发代理能解决生产跨域"** → 代理只在开发环境有效
5. ❌ **"带 Cookie 时 Allow-Origin 可以用 *"** → 不行，必须具体源
6. ❌ **"配置了 addCorsMappings 就万事大吉"** → 用了 Security 会被拦截，要用 `.cors()`
7. ❌ **"网关和服务都配 CORS 更保险"** → 会导致响应头重复而报错
8. ❌ **"OPTIONS 请求不用管"** → 必须放行，否则预检失败
9. ❌ **"跨域报错就加 allow-all 配置"** → 生产环境用 `*` 有安全风险
10. ❌ **"WebSocket 也有跨域问题"** → WebSocket 不受同源策略限制，但服务端可校验 Origin

## 一句话总结

> **跨域是浏览器的同源策略限制；CORS 是服务器声明"信任哪些源"的标准；真正的解决方案在服务端；带 Cookie 时不能用通配符；生产环境优先同域部署或用反向代理。**

---

> **延伸阅读**（项目内文档）：
> - [文件解析-06-vite.config.md](文件解析-06-vite.renderer.config.md)：Vite 代理配置（`server.proxy`）
> - [前端入职指南.md](../前端入职指南.md)：第五章调试技巧（DevTools Network 面板排查跨域）
