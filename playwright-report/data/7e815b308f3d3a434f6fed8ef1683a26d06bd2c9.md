# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "PTA-APP" [ref=e5] [cursor=pointer]:
          - /url: /
        - navigation [ref=e6]:
          - link "Admin" [ref=e7] [cursor=pointer]:
            - /url: /admin
    - main [ref=e8]:
      - main [ref=e9]:
        - heading "No autorizado" [level=1] [ref=e10]
        - paragraph [ref=e11]: "Sesión: sin sesión"
        - paragraph [ref=e12]:
          - text: Requiere rol
          - generic [ref=e13]: admin/manager/planner
          - text: en
          - code [ref=e14]: user_roles
          - text: (o en las tablas de respaldo
          - code [ref=e15]: admins / managers / planners
          - text: ).
    - contentinfo [ref=e16]:
      - generic [ref=e17]: © 2025 PTA-APP
  - button "Open Next.js Dev Tools" [ref=e23] [cursor=pointer]:
    - img [ref=e24] [cursor=pointer]
  - alert [ref=e27]: PTA Operadores
```