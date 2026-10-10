# Model notes and conventions

All quantities are **dimensionless / indexed** (base year = 100), so the app is
currency-agnostic. Monetary variables default to an index and are not taken from
country data.

## Production

$$Y = A\,K^{\alpha}L^{1-\alpha}, \qquad y = k^{\alpha}, \qquad MPK = \alpha\,\frac{y}{k}$$

Per effective worker, $k$ denotes capital per unit of effective labour.

## Solow-Swan

$$\dot{\hat{k}} = s\,\hat{k}^{\alpha} - (n+g+\delta)\,\hat{k}$$

$$\hat{k}^{*} = \left(\frac{s}{n+g+\delta}\right)^{\frac{1}{1-\alpha}}, \qquad
\hat{k}_{gr} = \left(\frac{\alpha}{n+g+\delta}\right)^{\frac{1}{1-\alpha}}$$

The golden rule sets $f'(\hat k)=n+g+\delta$, equivalently $s=\alpha$. Transition paths
are integrated with RK4.

## IS-LM (closed, linear)

$$C = c_0 + c_1(Y-T), \qquad I = I_0 - b\,r, \qquad M/P = k_Y Y - h_R r$$

$$Y^{*} = \frac{c_0 - c_1 T + I_0 + G + \tfrac{b}{h_R}\tfrac{M}{P}}{(1-c_1) + \tfrac{b\,k_Y}{h_R}}$$

Fiscal multiplier $= \left[(1-c_1) + \tfrac{b k_Y}{h_R}\right]^{-1}$.

## AD-AS

AD is the IS-LM output as $P$ varies. SRAS is $P = P^{e} + \lambda (Y - Y_n)$; LRAS is
vertical at $Y_n$, the Solow steady-state output $Y_n = A\,L\,\hat y^{*}$. Expectations
adjust as $\dot P^{e} = \theta (P - P^{e})$.

## Mundell-Fleming

$$(1-c_1+m)Y + b r + v\varepsilon = c_0 - c_1T + I_0 + G + X_0$$
$$k_Y Y - h_R r = M/P, \qquad -mY + \kappa r - v\varepsilon = \kappa(r^{*}+\rho) - X_0$$

Conventions:
- $\varepsilon$ is the **real exchange rate; a rise is an appreciation** (net exports fall).
- $NX = X_0 - mY - v\varepsilon$.
- **Small country ⇒ perfect capital mobility** ($r = r^{*}+\rho$, horizontal BP). **Large
  country ⇒ finite $\kappa$**, giving an upward-sloping BP.
- Floating: $\varepsilon$ clears the goods market. Fixed: $\varepsilon = \bar\varepsilon$ and
  the money supply adjusts endogenously.

Classic results, and asserted in the tests:
- Small + floating: fiscal policy has **no** output effect; monetary policy works.
- Small + fixed: fiscal policy works; monetary policy is neutral.

## Parity conditions

$$q = \frac{S\,P^{*}}{P}, \qquad \text{PPP: } S = \frac{P}{P^{*}}, \qquad
i = i^{*} + \rho + E[\dot e] \text{ (UIP)}$$

The trilemma: at most two of {fixed rate, free capital mobility, independent monetary
policy} can hold.

## External balance

$$CA = S - I, \qquad \Delta d = (r-g)\,d - \text{pb}, \qquad d^{*} = \frac{\text{pb}}{r-g}\ (r>g)$$

When $r \le g$ there is no finite debt steady state; the model reports this instead of
plotting an infinite line.

## Trade flows

Marshall-Lerner: a real depreciation improves the trade balance when
$|\eta_X| + |\eta_M| > 1$. The J-curve worsens the balance first, then improves it.

## Dornbusch overshooting

Money market $m - p = \phi y - \eta i$, UIP $\dot s = i - i^{*}$, sticky prices
$\dot p = \theta\gamma(s + p^{*} - p)$. The stable saddlepath is
$s - \bar s = (p - \bar p)/(\eta\lambda)$ with $\lambda<0$, so a monetary expansion pushes
$s$ past its long-run value before it appreciates back.
