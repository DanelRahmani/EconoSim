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

## AK endogenous growth

$$Y = A\,K, \qquad \dot K = s\,Y - \delta K \quad\Longrightarrow\quad \gamma = s\,A - \delta - n$$

Returns to capital never diminish, so there is no steady state to converge to: the growth
rate of output per worker is a policy variable, and the saving rate moves it permanently.
Contrast Solow, where $s$ moves the *level* of output but never its long-run growth rate.
Growth is positive only when $sA > \delta + n$. $A$ is set to the economy's current
average product of capital $Y/K$, so AK reproduces today's output exactly and the only
thing that differs is what happens next. The honest caveat: constant returns to capital is
an assumption, not a finding.

## IS-LM (closed, linear)

$$C = c_0 + c_1(Y-T), \qquad I = I_0 - b\,r, \qquad M/P = k_Y Y - h_R r$$

$$Y^{*} = \frac{c_0 - c_1 T + I_0 + G + \tfrac{b}{h_R}\tfrac{M}{P}}{(1-c_1) + \tfrac{b\,k_Y}{h_R}}$$

Fiscal multiplier $= \left[(1-c_1) + \tfrac{b k_Y}{h_R}\right]^{-1}$.

## AD-AS

AD is the IS-LM output as $P$ varies. SRAS is $P = P^{e} + \lambda (Y - Y_n)$; LRAS is
vertical at $Y_n$, the Solow steady-state output $Y_n = A\,L\,\hat y^{*}$. Expectations
adjust as $\dot P^{e} = \theta (P - P^{e})$.

## Zero lower bound

The natural rate $r_n$ falls with the demand shock, and once it is negative no positive
policy rate can hold output at potential. The rate is clamped at zero, so the LM curve is
flat over the range where it would have been negative:

$$r = \max\{0,\ r_n\}, \qquad
\left.\frac{dY}{dG}\right|_{\text{floor}} = \frac{1}{1-c_1}, \qquad
\left.\frac{dY}{dG}\right|_{\text{away}} = \left[(1-c_1) + \frac{b\,k_Y}{h_R}\right]^{-1}$$

The first is the IS-only multiplier: with the rate pinned at zero there is no crowding out
through the interest rate, so fiscal policy is unusually powerful. The model tracks the
kink and reports both multipliers beside each other.

## Phillips curve

$$\pi = \pi^{e} - \beta\,(u - u_n), \qquad \frac{Y - Y_n}{Y_n} = -0.5\,(u - u_n)$$

Expectations adjust as $\pi^{e}_{t+1} = \pi^{e}_{t} + \theta(\pi_t - \pi^{e}_t)$. The
disinflation is cold turkey — the bank delivers the target at once and holds it — so
unemployment must stay above its natural rate for as long as expectations lag, and the
sacrifice ratio has the closed form

$$\text{sacrifice ratio} = \frac{1}{\beta\,\theta}$$

With a credible announcement $\pi^{e}$ jumps to the target at impact, unemployment never
leaves $u_n$, and the cost is exactly zero. It is the same model with one switch flipped,
which is the Lucas-critique lesson the panel is built to show.

## WS-PS labour market

$$WS:\ \frac{W}{P} = 1 - \gamma u + z, \qquad PS:\ \frac{W}{P} = \frac{1}{1+m}$$

Setting the two real wages equal gives the natural rate, exactly and to first order:

$$u_n = \frac{1 + z - \frac{1}{1+m}}{\gamma} \;\approx\; \frac{m + z}{\gamma}$$

Both are reported, because the textbook $u_n = (m+z)/\gamma$ is an approximation that
only holds for small mark-ups. A higher mark-up $m$ or more bargaining power $z$ raises
$u_n$; more wage flexibility (a larger $\gamma$) lowers it.

## Debt dynamics

$$r = r^{*} + \rho, \qquad g = n + g_A, \qquad \Delta b = (r - g)\,b - \text{pb}$$

The primary balance that holds the ratio still is $\text{pb} = (r-g)\,b$. Note what that
is: a **knife edge, not a convergence point**. With $r > g$, $\Delta b$ *increases* in
$b$, so a ratio just above the balance point keeps rising and one just below it keeps
falling — the economy drifts away from it in both directions. Set $r \le g$ and the sign
of the whole effect flips: debt then melts away on its own, and no positive ratio holds
still.

## Currency crisis

Credit grows at $\mu$ per period and the deficit is financed by printing, so the central
bank sells reserves to hold the peg until they run out. The collapse date is the
first-generation closed form

$$T^{*} = \frac{-\ln\!\left(1 - R_0/M\right)}{\ln(1+\mu)}$$

with $R_0$ initial reserves and $M$ the money supply. Faster credit growth brings the
crisis forward. When $R_0 \ge M$ or $\mu = 0$ the peg survives, no date exists, and the
model omits the row rather than reporting an infinity.

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

$$CA = S - I, \qquad \Delta d = (r-g)\,d - \text{pb}, \qquad
\Delta d = 0 \text{ at } d = \frac{\text{pb}}{r-g}\ (r>g)$$

With $r > g$ that ratio is a **knife edge, not a convergence point**: $\Delta d$ rises with
$d$, so debt drifts away from it in both directions. When $r \le g$ there is no finite
resting level at all, and the model reports that instead of plotting a line that does not
exist.

## Trade flows

Marshall-Lerner: a real depreciation improves the trade balance when
$|\eta_X| + |\eta_M| > 1$. The J-curve worsens the balance first, then improves it.

## Dornbusch overshooting

Money market $m - p = \phi y - \eta i$, UIP $\dot s = i - i^{*}$, sticky prices
$\dot p = \theta\gamma(s + p^{*} - p)$. The stable saddlepath is
$s - \bar s = (p - \bar p)/(\eta\lambda)$ with $\lambda<0$, so a monetary expansion pushes
$s$ past its long-run value before it appreciates back.

## Consumer choice

$$U = x^{\alpha}y^{1-\alpha}, \qquad p_x x + p_y y = I$$

$$\frac{\alpha}{1-\alpha}\cdot\frac{y}{x} = \frac{p_x}{p_y}
\;\Longrightarrow\; x^{*} = \frac{\alpha I}{p_x}, \qquad y^{*} = \frac{(1-\alpha)\,I}{p_y}$$

The tangency condition is the whole of the equilibrium: at the optimum the MRS equals the
price ratio, and if the two differed the consumer could trade along the budget line and do
better. With Cobb-Douglas preferences the tangency also fixes the income share spent on
each good, whatever the prices are.

## Competition vs monopoly

Demand $P = a - bQ$ with constant marginal cost $c$:

$$Q_c = \frac{a-c}{b}, \quad P_c = c; \qquad
Q_m = \frac{a-c}{2b}, \quad P_m = \frac{a+c}{2}$$

$$\text{Lerner index} = \frac{P_m - c}{P_m} = \frac{a-c}{a+c}, \qquad
\text{DWL} = \tfrac{1}{2}\,(Q_c - Q_m)(P_m - c) = \frac{(a-c)^2}{8b}$$

The deadweight loss is a triangle because both curves are straight here, and it is
*destroyed* rather than transferred: the rest of the consumer loss is the firm's operating
profit. Fixed costs are identical under either structure, so they cancel in the surplus
comparison but not in profit.

## Externalities and the Pigouvian tax

Demand $P = a - bQ$, private marginal cost $c$, marginal external cost $x$. Firms stop
where price equals *private* cost; society wants price equal to *social* cost:

$$Q_p = \frac{a-c}{b}, \qquad Q_s = \frac{a-c-x}{b}, \qquad
\text{DWL} = \tfrac{1}{2}\,x\,(Q_p - Q_s) = \frac{x^2}{2b}$$

A tax $t$ per unit shifts private cost to $c+t$, leaving a residual distortion

$$\text{DWL}(t) = \frac{(t-x)^2}{2b}$$

which is zero exactly at $t = x$ — the Pigouvian tax — and positive on both sides of it.
The parabola the model plots shows both halves of that: too little tax leaves harm
unpriced, too much destroys surplus the other way. The regulator has to know $x$, which is
the real difficulty.

## Game theory

The four 2×2 games (prisoner's dilemma, coordination, chicken, matching pennies) are
solved generically rather than tabulated: best responses, dominance, pure and mixed Nash
equilibria. For the dilemma the model also reports the joint payoff lost to mutual
defection, $2(R-P)$, and the discount factor

$$\delta^{*} = \frac{T - R}{T - P}$$

above which cooperation is sustainable in the repeated game, where $R$ is the mutual
cooperation payoff, $T$ the temptation and $P$ the mutual defection payoff.
