const { withMainActivity } = require('@expo/config-plugins');

const withKeyEvent = (config) => {
  return withMainActivity(config, (config) => {
    if (config.modResults.language === 'java') {
      // Java implementation
      let contents = config.modResults.contents;

      // Add import
      if (!contents.includes('import com.github.kevinejohn.keyevent.KeyEventModule;')) {
        contents = contents.replace(
          /import android\.os\.Bundle;/,
          `import android.os.Bundle;\nimport com.github.kevinejohn.keyevent.KeyEventModule;`
        );
      }

      // Add onKeyDown method
      if (!contents.includes('KeyEventModule.getInstance().onKeyDownEvent')) {
        const onKeyDownMethod = `
  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    KeyEventModule.getInstance().onKeyDownEvent(keyCode, event);
    return super.onKeyDown(keyCode, event);
  }

  @Override
  public boolean onKeyUp(int keyCode, KeyEvent event) {
    KeyEventModule.getInstance().onKeyUpEvent(keyCode, event);
    return super.onKeyUp(keyCode, event);
  }

  @Override
  public boolean onKeyMultiple(int keyCode, int repeatCount, KeyEvent event) {
    KeyEventModule.getInstance().onKeyMultipleEvent(keyCode, repeatCount, event);
    return super.onKeyMultiple(keyCode, repeatCount, event);
  }
`;

        // Insert before the last closing brace
        const lastBraceIndex = contents.lastIndexOf('}');
        contents = contents.slice(0, lastBraceIndex) + onKeyDownMethod + contents.slice(lastBraceIndex);
      }

      config.modResults.contents = contents;
    } else if (config.modResults.language === 'kt') {
      // Kotlin implementation
      let contents = config.modResults.contents;

      // Add import
      if (!contents.includes('import com.github.kevinejohn.keyevent.KeyEventModule')) {
        contents = contents.replace(
          /import android\.os\.Bundle/,
          `import android.os.Bundle\nimport com.github.kevinejohn.keyevent.KeyEventModule\nimport android.view.KeyEvent`
        );
      }

      // Add onKeyDown method
      if (!contents.includes('KeyEventModule.getInstance().onKeyDownEvent')) {
        const onKeyDownMethod = `
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyDownEvent(keyCode, event)
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyUpEvent(keyCode, event)
    return super.onKeyUp(keyCode, event)
  }

  override fun onKeyMultiple(keyCode: Int, repeatCount: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyMultipleEvent(keyCode, repeatCount, event)
    return super.onKeyMultiple(keyCode, repeatCount, event)
  }
`;

        // Insert before the last closing brace
        const lastBraceIndex = contents.lastIndexOf('}');
        contents = contents.slice(0, lastBraceIndex) + onKeyDownMethod + contents.slice(lastBraceIndex);
      }

      config.modResults.contents = contents;
    }

    return config;
  });
};

module.exports = withKeyEvent;

