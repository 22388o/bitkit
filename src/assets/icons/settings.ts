export const chevronRightIcon = (
	color = '#FFFFFF',
): string => `<svg width="7" height="12" viewBox="0 0 7 12" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M0.822528 0C0.357621 0 0 0.347721 0 0.81135C0 1.04316 0.0983458 1.23932 0.241394 1.39089L5.00626 6L0.241394 10.6091C0.0983458 10.7607 0 10.9658 0 11.1886C0 11.6523 0.357621 12 0.822528 12C1.05498 12 1.25167 11.9198 1.40366 11.7682L6.74967 6.58845C6.91954 6.42797 7 6.2229 7 6C7 5.7771 6.91954 5.58095 6.74967 5.41155L1.40366 0.24073C1.25167 0.0802431 1.05498 0 0.822528 0Z" fill="${color}"/>
</svg>
`;

export const leftArrowIcon = (
	color = '#636366',
): string => `<svg width="20" height="18" viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg">
<path d="M3.4938 8.00012L9.34743 2.42896L7.96861 0.980225L0.310587 8.2687C-0.103212 8.66253 -0.103578 9.32238 0.309783 9.71667L7.96781 17.0214L9.34824 15.5742L3.50459 10.0001L19.9999 10.0012L20.0001 8.00118L11.7469 8.00065L3.4938 8.00012Z" fill=${color}/>
</svg>
`;

export const rightArrowIcon = (color = 'white'): string =>
	`<svg fill="red" height="24" viewBox="0 0 25 24" width="25" xmlns="http://www.w3.org/2000/svg"><path d="m1.55493 12c0 .6094.42188 1.043 1.03125 1.043h15.43362l2.5078-.0938-3.8555 3.5156-2.625 2.6719c-.1875.1758-.2812.457-.2812.7383 0 .5859.4453 1.0078 1.0195 1.0078.2813 0 .5273-.1055.7617-.3281l7.793-7.7695c.2344-.2227.3516-.4922.3516-.7852-.0001-.293-.1172-.5625-.3516-.7852l-7.793-7.78121c-.2344-.22265-.4805-.3164-.7617-.3164-.5742 0-1.0195.42187-1.0195 1.00781 0 .28125.0937.55078.2812.73828l2.625 2.67188 3.8438 3.50394-2.4961-.0821h-15.43362c-.60937 0-1.03125.4336-1.03125 1.043z" fill="${color}"/></svg>`;

export const checkmarkIcon = (color = '#33CE59'): string =>
	`<svg fill="none" height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m27.7071 8.29352c.3905.39053.3905 1.0237 0 1.41421l-14 13.99937c-.3905.3905-1.0237.3905-1.4142 0l-6.99998-6.9993c-.39054-.3906-.39057-1.0237-.00006-1.4143.39051-.3905 1.02367-.3905 1.41422 0l6.29292 6.2923 13.2929-13.29231c.3905-.39052 1.0237-.3905 1.4142.00003z" fill="${color}" fill-rule="evenodd"/></svg>`;

export const copyIcon = (
	color = '#F75C1A',
): string => `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
<path d="M8.25 9H0.75C0.33525 9 0 8.66475 0 8.25V0.75C0 0.336 0.33525 0 0.75 0H8.25C8.66475 0 9 0.336 9 0.75V8.25C9 8.66475 8.66475 9 8.25 9Z" fill="${color}"/>
<path d="M11.25 12H3V10.5H10.5V3H12V11.25C12 11.6647 11.6647 12 11.25 12Z" fill="${color}"/>
</svg>`;
