import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './screens/LoginScreen';
import GoogleLoginScreen from './screens/GoogleLoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import InspectionScreen from './screens/InspectionScreen';
import ChecklistScreen from './screens/ChecklistScreen';
import ComparisonScreen from './screens/ComparisonScreen';
import DriveScreen from './screens/DriveScreen';
import DriveAdvancedScreen from './screens/DriveAdvancedScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="GoogleLogin" component={GoogleLoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Inspection" component={InspectionScreen} />
        <Stack.Screen name="Checklist" component={ChecklistScreen} />
        <Stack.Screen name="Comparison" component={ComparisonScreen} />
  <Stack.Screen name="Drive" component={DriveScreen} />
  <Stack.Screen name="DriveAdvanced" component={DriveAdvancedScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
