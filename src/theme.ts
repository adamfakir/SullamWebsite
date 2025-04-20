// src/theme.ts
import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
    colors: {
        accent: {
            500: "#4CAF50",
        },
    },
    styles: {
        global: (props: any) => ({
            body: {
                bg: props.colorMode === "dark" ? "#1F1F1F" : "#FFFFFF",
                color: props.colorMode === "dark" ? "#FFFFFF" : "#000000",
            },
        }),
    },
    components: {
        Button: {
            baseStyle: {
                fontWeight: "medium",
            },
            defaultProps: {
                colorScheme: "green",
            },
        },
    },
});

export default theme;